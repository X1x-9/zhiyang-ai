import type { SpaceProfile } from "./space";

const globalForDemoProfile = globalThis as unknown as {
  demoProfiles?: Map<string, SpaceProfile>;
};

function profileStore() {
  if (!globalForDemoProfile.demoProfiles) globalForDemoProfile.demoProfiles = new Map();
  return globalForDemoProfile.demoProfiles;
}

export function readDemoProfile(sessionId: string): SpaceProfile | null {
  return profileStore().get(sessionId) ?? null;
}

export function writeDemoProfile(sessionId: string, profile: SpaceProfile) {
  profileStore().set(sessionId, profile);
  return profile;
}

export function clearDemoProfile(sessionId: string) {
  profileStore().delete(sessionId);
}
