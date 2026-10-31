// src/campaign-setup/prisma-checkpoint.saver.ts
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  compareWritesSortKeys,
  copyCheckpoint,
  getCheckpointId,
  WRITES_IDX_MAP,
  writesSortKey,
} from '@langchain/langgraph-checkpoint';
import type {
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointTuple,
  PendingWrite,
} from '@langchain/langgraph-checkpoint';
import { Injectable } from '@nestjs/common';
import { AgentCheckpoint } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

// LangGraph's Postgres saver needs JSONB columns, which this schema doesn't allow,
// so this keeps the same contract with the serialized state stored as bytes.
@Injectable()
export class PrismaCheckpointSaver extends BaseCheckpointSaver {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private location(config: RunnableConfig) {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) {
      throw new Error('A checkpoint needs a thread_id');
    }
    return {
      threadId,
      checkpointNs: (config.configurable?.checkpoint_ns as string) ?? '',
    };
  }

  private async toTuple(row: AgentCheckpoint): Promise<CheckpointTuple> {
    const { threadId, checkpointNs, checkpointId, parentCheckpointId } = row;

    const writes = await this.prisma.agentCheckpointWrite.findMany({
      where: { threadId, checkpointNs, checkpointId },
    });
    const ordered = writes
      .map((write) => ({
        write,
        key: writesSortKey(write.taskPath, write.taskId, write.idx),
      }))
      .sort((a, b) => compareWritesSortKeys(a.key, b.key));

    const location = {
      thread_id: threadId,
      checkpoint_ns: checkpointNs,
    };

    return {
      config: { configurable: { ...location, checkpoint_id: checkpointId } },
      checkpoint: (await this.serde.loadsTyped(
        row.dataType,
        row.data,
      )) as Checkpoint,
      metadata: (await this.serde.loadsTyped(
        row.metadataType,
        row.metadata,
      )) as CheckpointMetadata,
      pendingWrites: await Promise.all(
        ordered.map(
          async ({ write }) =>
            [
              write.taskId,
              write.channel,
              await this.serde.loadsTyped(write.valueType, write.value),
            ] as [string, string, unknown],
        ),
      ),
      ...(parentCheckpointId
        ? {
            parentConfig: {
              configurable: { ...location, checkpoint_id: parentCheckpointId },
            },
          }
        : {}),
    };
  }

  async getTuple(config: RunnableConfig) {
    const { threadId, checkpointNs } = this.location(config);
    const checkpointId = getCheckpointId(config);

    const row = await this.prisma.agentCheckpoint.findFirst({
      where: {
        threadId,
        checkpointNs,
        ...(checkpointId ? { checkpointId } : {}),
      },
      orderBy: { checkpointId: 'desc' },
    });

    return row ? this.toTuple(row) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions) {
    const { threadId, checkpointNs } = this.location(config);
    const before = options?.before?.configurable?.checkpoint_id as
      | string
      | undefined;

    const rows = await this.prisma.agentCheckpoint.findMany({
      where: {
        threadId,
        checkpointNs,
        ...(before ? { checkpointId: { lt: before } } : {}),
      },
      orderBy: { checkpointId: 'desc' },
      take: options?.limit,
    });

    for (const row of rows) {
      yield await this.toTuple(row);
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ) {
    const { threadId, checkpointNs } = this.location(config);
    const [dataType, data] = await this.serde.dumpsTyped(
      copyCheckpoint(checkpoint),
    );
    const [metadataType, metadataBytes] = await this.serde.dumpsTyped(metadata);

    const stored = {
      parentCheckpointId: config.configurable?.checkpoint_id as
        | string
        | undefined,
      dataType,
      data: Buffer.from(data),
      metadataType,
      metadata: Buffer.from(metadataBytes),
    };

    await this.prisma.agentCheckpoint.upsert({
      where: {
        threadId_checkpointNs_checkpointId: {
          threadId,
          checkpointNs,
          checkpointId: checkpoint.id,
        },
      },
      create: { threadId, checkpointNs, checkpointId: checkpoint.id, ...stored },
      update: stored,
    });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
    taskPath?: string,
  ) {
    const { threadId, checkpointNs } = this.location(config);
    const checkpointId = config.configurable?.checkpoint_id as string;

    await Promise.all(
      writes.map(async ([channel, value], index) => {
        const [valueType, bytes] = await this.serde.dumpsTyped(value);
        const idx = WRITES_IDX_MAP[channel] ?? index;

        const stored = {
          taskPath: taskPath ?? '',
          channel,
          valueType,
          value: Buffer.from(bytes),
        };

        await this.prisma.agentCheckpointWrite.upsert({
          where: {
            threadId_checkpointNs_checkpointId_taskId_idx: {
              threadId,
              checkpointNs,
              checkpointId,
              taskId,
              idx,
            },
          },
          create: { threadId, checkpointNs, checkpointId, taskId, idx, ...stored },
          // Special channels use negative slots and must stay first-write-wins
          update: idx >= 0 ? {} : stored,
        });
      }),
    );
  }

  async deleteThread(threadId: string) {
    await this.prisma.$transaction([
      this.prisma.agentCheckpointWrite.deleteMany({ where: { threadId } }),
      this.prisma.agentCheckpoint.deleteMany({ where: { threadId } }),
    ]);
  }
}
