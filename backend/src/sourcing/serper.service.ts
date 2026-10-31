// src/sourcing/serper.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from '@prisma/client';

const SERPER_URL = 'https://google.serper.dev/search';
const RESULTS_PER_PAGE = 10;
const REQUEST_TIMEOUT_MS = 20_000;
const SKILLS_IN_QUERY = 2;

type OrganicResult = { title?: string; link?: string; snippet?: string };

@Injectable()
export class SerperService {
  constructor(private readonly configService: ConfigService) {}

  // Only searches public results. LinkedIn itself is never scraped.
  buildQuery(job: Pick<Job, 'title' | 'mustHaveSkills' | 'location' | 'remotePolicy'>) {
    const skills = job.mustHaveSkills
      .slice(0, SKILLS_IN_QUERY)
      .map((skill) => `"${skill}"`);
    const location = job.remotePolicy === 'REMOTE' ? null : job.location;

    return ['site:linkedin.com/in', job.title, ...skills, location]
      .filter(Boolean)
      .join(' ');
  }

  async search(query: string, page: number): Promise<OrganicResult[]> {
    const response = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.configService.get<string>('SERPER_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: RESULTS_PER_PAGE, page }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const { organic } = (await response.json()) as { organic?: OrganicResult[] };
    return organic ?? [];
  }
}
