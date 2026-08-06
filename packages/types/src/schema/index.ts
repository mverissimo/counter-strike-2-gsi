import { scope } from "arktype";

// The closed string unions below (mode/phase/state/type/team/activity fields)
// mirror CS2's own enums. A game update that adds a new value to one of them
// shows up at runtime as a validation warning naming that exact path — that's
// CS2 drift, not bad data. See the "validation warning" note in this
// package's README before dismissing one.
const $root = scope({
  auth: {
    token: "string",
  },
  provider: {
    name: "string",
    appid: "number",
    version: "number",
    steamid: "string",
    timestamp: "number >=0",
  },
  map: {
    mode: "'casual' | 'custom' | 'competitive' | 'deathmatch' | 'gungameprogressive' | 'new_user_training' | 'wingman' | 'workshop'",
    // Deliberately open: pinning the official map pool here rejects
    // workshop/custom maps and breaks whole-payload validation on every
    // map-pool update.
    name: "string",
    phase: "'freezetime' | 'gameover' | 'intermission' | 'live' | 'over' | 'warmup'",
    round: "number",
    team_ct: {
      "name?": "string",
      score: "number",
      consecutive_round_losses: "number",
      timeouts_remaining: "number",
      matches_won_this_series: "number",
    },
    team_t: {
      "name?": "string",
      score: "number",
      consecutive_round_losses: "number",
      timeouts_remaining: "number",
      matches_won_this_series: "number",
    },
    "round_wins?": {
      "[string]":
        "'t_win_bomb' | 't_win_bomb_elimination' | 't_win_elimination' | 'ct_win_defuse' | 'ct_win_elimination' | 'ct_win_time'",
    },
    num_matches_to_win_series: "number",
    current_spectators: "number?",
    souvenirs_total: "number?",
  },
  bomb: {
    "state?":
      "'carried' | 'dropped' | 'defused' | 'defusing' | 'exploded' | 'planted' | 'planting'",
    "position?": "string",
    "countdown?": "string",
    "player?": "string",
  },
  round: {
    phase: "'freezetime' | 'gameover' | 'intermission' | 'live' | 'over' | 'warmup'",
    "bomb?": "'defused' | 'exploded' | 'planted'",
    "win_team?": "'CT' | 'T'",
  },
  player: {
    "steamid?": "string",
    "name?": "string",
    "activity?": "'playing' | 'textinput' | 'menu'",
    "observer_slot?": "0 <= number <= 9",
    "team?": "'CT' | 'T'",
    "state?": {
      health: "0 <= number <= 100",
      armor: "0 <= number <= 100",
      helmet: "boolean",
      flashed: "number",
      smoked: "number",
      burning: "number",
      money: "number",
      round_kills: "number",
      round_killhs: "number",
      "round_totaldmg?": "number",
      equip_value: "number",
      "defuse_kit?": "boolean",
    },
    "weapons?": {
      "[string]": {
        name: "string",
        "type?":
          "'BreachCharge' | 'C4' | 'Fists' | 'Grenade' | 'Pistol' | 'Knife' | 'Melee' | 'Submachine Gun' | 'Machine Gun' | 'Rifle' | 'Shotgun' | 'SniperRifle' | 'Stackable' | 'Tablet' | 'Taser'",
        paintkit: "string",
        state: "'active' | 'holstered' | 'reloading'",
        "ammo_clip?": "number",
        "ammo_clip_max?": "number",
        "ammo_reserve?": "number",
      },
    },
    "match_stats?": {
      kills: "number",
      assists: "number",
      deaths: "number",
      mvps: "number",
      score: "number",
    },
    "spectarget?": "string",
    "position?": "string",
    "forward?": "string",
  },
  phase_countdowns: {
    "phase?":
      "'bomb' | 'defuse' | 'freezetime' | 'live' | 'over' | 'timeout_t' | 'timeout_ct' | 'warmup'",
    phase_ends_in: "string",
  },
  allplayers: {
    "[string]": {
      "...": "player",
    },
    "custom?": {
      left: "string[]",
      joined: "string[]",
    },
  },
  grenades: {
    "[string]": {
      "owner?": "string",
      "position?": "string",
      "velocity?": "string",
      lifetime: "string",
      "type?": "'frag' | 'flashbang' | 'firebomb' | 'inferno' | 'smoke' | 'decoy'",
      "flames?": {
        "[string]": "string",
      },
      "effecttime?": "string",
    },
  },
  payload: {
    "auth?": "auth",
    "provider?": "provider",
    "map?": "map",
    "bomb?": "bomb",
    "round?": "round",
    "player?": "player",
    "phase_countdowns?": "phase_countdowns",
    "allplayers?": "allplayers",
    "grenades?": "grenades",
  },
  delta: {
    "previously?": "object",
  },
});

export const schema = $root.export();

export type SchemaAuth = typeof schema.auth.infer;
export type SchemaProvider = typeof schema.provider.infer;
export type SchemaMap = typeof schema.map.infer;
export type SchemaBomb = typeof schema.bomb.infer;
export type SchemaRound = typeof schema.round.infer;
export type SchemaPlayer = typeof schema.player.infer;
export type SchemaPhaseCountdowns = typeof schema.phase_countdowns.infer;
export type SchemaAllPlayers = typeof schema.allplayers.infer;
export type SchemaGrenades = typeof schema.grenades.infer;
export type SchemaPayload = typeof schema.payload.infer;
export type SchemaDelta = typeof schema.delta.infer;
