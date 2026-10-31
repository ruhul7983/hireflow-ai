"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ActionButtons } from "@/components/chat/action-buttons";
import { api } from "@/lib/api";
import type { JobDraft, PendingAction, RemotePolicy } from "@/lib/chat-types";

const fieldClass =
  "w-full rounded-lg border border-muted/70 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:bg-canvas disabled:text-muted";

const TEXT_FIELDS = [
  { key: "title", label: "Job title" },
  { key: "seniority", label: "Seniority" },
  { key: "location", label: "Location" },
  { key: "salary", label: "Salary" },
] as const;

const REMOTE_OPTIONS: { value: RemotePolicy; label: string }[] = [
  { value: "ONSITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" },
];

const STATUS_NOTES: Record<PendingAction["status"], string> = {
  PENDING: "",
  EXECUTED: "Job created from this draft.",
  CANCELLED: "This draft was cancelled.",
  FAILED: "This draft could not be saved.",
};

type SkillsFieldProps = {
  label: string;
  skills: string[];
  disabled: boolean;
  onChange: (skills: string[]) => void;
};

function SkillsField({ label, skills, disabled, onChange }: SkillsFieldProps) {
  const [value, setValue] = useState("");

  function addSkill() {
    const skill = value.trim().replace(/,$/, "");
    setValue("");
    if (skill && !skills.includes(skill)) onChange([...skills, skill]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill();
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <p className="text-sm font-medium">{label}</p>
      <ul className="flex flex-wrap gap-1.5 empty:hidden">
        {skills.map((skill) => (
          <li
            key={skill}
            className="flex items-center gap-1 rounded-md bg-brand-soft py-1 pr-1 pl-2 text-xs font-medium text-brand-strong"
          >
            {skill}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(skills.filter((item) => item !== skill))}
                aria-label={`Remove ${skill}`}
                className="rounded p-0.5 hover:bg-brand/10"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addSkill}
          aria-label={`Add to ${label}`}
          placeholder="Type a skill and press Enter"
          className={fieldClass}
        />
      )}
    </div>
  );
}

type JobDraftCardProps = {
  draft: JobDraft;
  action: PendingAction;
  onChanged: () => void;
};

export function JobDraftCard({ draft, action, onChanged }: JobDraftCardProps) {
  const [fields, setFields] = useState(draft);
  const isOpen = action.status === "PENDING";

  // Each edit is saved, so answering "yes" in chat confirms what's on screen
  function save(patch: Partial<JobDraft>) {
    return api(`/chat/job-drafts/${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  function update(patch: Partial<JobDraft>) {
    setFields((current) => ({ ...current, ...patch }));
  }

  function updateAndSave(patch: Partial<JobDraft>) {
    update(patch);
    void save(patch);
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`${draft.id}-${key}`} className="block text-sm font-medium">
              {label}
            </label>
            <input
              id={`${draft.id}-${key}`}
              value={fields[key] ?? ""}
              disabled={!isOpen}
              placeholder="Not stated"
              onChange={(event) => update({ [key]: event.target.value })}
              onBlur={(event) =>
                void save({ [key]: event.target.value.trim() || null })
              }
              className={fieldClass}
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <label htmlFor={`${draft.id}-remote`} className="block text-sm font-medium">
            Work mode
          </label>
          <select
            id={`${draft.id}-remote`}
            value={fields.remotePolicy ?? ""}
            disabled={!isOpen}
            onChange={(event) =>
              updateAndSave({
                remotePolicy: (event.target.value || null) as RemotePolicy | null,
              })
            }
            className={fieldClass}
          >
            <option value="">Not stated</option>
            {REMOTE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <SkillsField
          label="Must-have skills"
          skills={fields.mustHaveSkills}
          disabled={!isOpen}
          onChange={(mustHaveSkills) => updateAndSave({ mustHaveSkills })}
        />
        <SkillsField
          label="Nice-to-have skills"
          skills={fields.niceToHaveSkills}
          disabled={!isOpen}
          onChange={(niceToHaveSkills) => updateAndSave({ niceToHaveSkills })}
        />
      </div>

      <div className="mt-4">
        {isOpen ? (
          <ActionButtons
            actionId={action.id}
            confirmLabel="Create job"
            disabled={!fields.title?.trim()}
            beforeConfirm={async () => {
              await save({
                title: fields.title?.trim() || null,
                seniority: fields.seniority?.trim() || null,
                location: fields.location?.trim() || null,
                salary: fields.salary?.trim() || null,
              });
            }}
            onChanged={onChanged}
          />
        ) : (
          <p className="text-sm text-muted">{STATUS_NOTES[action.status]}</p>
        )}
      </div>
    </div>
  );
}
