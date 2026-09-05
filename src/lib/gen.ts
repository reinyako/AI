import type { Contact, GenOverrides, GenSettings, Provider, ResolvedGen } from '../types';

export const GEN_KEYS = ['temperature', 'topP', 'maxTokens', 'historyLimit', 'humanize'] as const;

/**
 * Menggabungkan setelan global, override kontak, dan model dari provider aktif.
 * Override kontak selalu menang; yang tidak diisi ikut global.
 */
export function resolveGen(
  overrides: GenOverrides,
  defaults: GenSettings,
  provider: Provider
): ResolvedGen {
  return {
    model: (overrides.model ?? provider.model).trim(),
    temperature: overrides.temperature ?? defaults.temperature,
    topP: overrides.topP ?? defaults.topP,
    maxTokens: overrides.maxTokens ?? defaults.maxTokens,
    historyLimit: overrides.historyLimit ?? defaults.historyLimit,
    humanize: overrides.humanize ?? defaults.humanize,
  };
}

/** Ada setidaknya satu setelan yang dioprek khusus untuk kontak ini? */
export function hasOverrides(overrides: GenOverrides): boolean {
  return Object.values(overrides).some((value) => value !== undefined);
}

/**
 * System prompt untuk satu percakapan.
 *
 * Agent memakai instruksinya sendiri: instruksi karakter justru melarang model
 * bersikap seperti asisten, jadi keduanya tidak boleh tercampur.
 */
export function buildSystemPrompt(
  contact: Pick<Contact, 'kind' | 'persona'>,
  prompts: { globalPrompt: string; agentPrompt: string }
): string {
  if (contact.kind === 'agent') return prompts.agentPrompt.trim();

  const persona = contact.persona.trim();
  return [prompts.globalPrompt.trim(), persona ? `Karakter yang kamu perankan:\n${persona}` : '']
    .filter(Boolean)
    .join('\n\n');
}
