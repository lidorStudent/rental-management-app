import "server-only";

import { randomInt } from "node:crypto";

const LOWERCASE_LETTERS = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const TEMPORARY_PASSWORD_LENGTH = 14;

/**
 * A password a landlord reads aloud or types into a message, so the alphabet leaves out the
 * characters people confuse: no l, I, 1, O or 0.
 *
 * It is generated with the crypto random source rather than Math.random, and it satisfies the
 * password policy the Supabase project enforces: at least ten characters, with a lowercase letter,
 * an uppercase letter and a digit.
 */
export function generateTemporaryPassword(): string {
  const everyCharacter = LOWERCASE_LETTERS + UPPERCASE_LETTERS + DIGITS;

  const characters = [
    pickRandomCharacter(LOWERCASE_LETTERS),
    pickRandomCharacter(UPPERCASE_LETTERS),
    pickRandomCharacter(DIGITS),
  ];
  while (characters.length < TEMPORARY_PASSWORD_LENGTH) {
    characters.push(pickRandomCharacter(everyCharacter));
  }

  return shuffle(characters).join("");
}

function pickRandomCharacter(alphabet: string): string {
  return alphabet.charAt(randomInt(alphabet.length));
}

function shuffle(characters: string[]): string[] {
  const shuffled = [...characters];
  for (let position = shuffled.length - 1; position > 0; position -= 1) {
    const swapWith = randomInt(position + 1);
    const held = shuffled[position];
    shuffled[position] = shuffled[swapWith];
    shuffled[swapWith] = held;
  }
  return shuffled;
}
