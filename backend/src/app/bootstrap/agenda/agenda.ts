import Agenda, { type Job } from "agenda";
import { processNoteJob, type ProcessNoteJobData } from "@/app/services/notes/processNote";

let agendaInstance: Agenda | null = null;

export function getAgenda(): Agenda {
  if (!agendaInstance) {
    throw new Error("Agenda has not been initialized");
  }
  return agendaInstance;
}

export async function startAgenda(): Promise<Agenda> {
  const mongoUri =
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/notebooklm";

  agendaInstance = new Agenda({
    db: { address: mongoUri, collection: "agendaJobs" },
    processEvery: "5 seconds",
    maxConcurrency: 2,
  });

  agendaInstance.define<ProcessNoteJobData>(
    "processNote",
    { concurrency: 2 },
    async (job: Job<ProcessNoteJobData>) => {
      const data = job.attrs.data as ProcessNoteJobData;
      await processNoteJob(data);
    },
  );

  await agendaInstance.start();
  return agendaInstance;
}

export async function scheduleProcessNote(data: ProcessNoteJobData) {
  const agenda = getAgenda();
  await agenda.now("processNote", data);
}

export async function stopAgenda() {
  if (agendaInstance) {
    await agendaInstance.stop();
    agendaInstance = null;
  }
}
