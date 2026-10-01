"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const PLAYER_PHOTOS = {
  Dan: "/IMG_5160.jpg",
  Steve: "/IMG_5160%202.jpg",
  Dave: "/IMG_5160%203.png",
  Rich: "/IMG_5160%204.jpg",
  Matt: "/IMG_5160%205.jpg",
  Nathan: "/IMG_5160%206.jpg",
};

const HERO_IMAGE = "/IMG_5159.jpeg";

const GAME_LABELS = {
  skins: "Skins",
  match_play: "Match Play",
  better_ball: "Better Ball",
  pairs_stableford: "Pairs Stableford",
  team_stableford: "Team Stableford",
};

const TEAM_GAMES = new Set([
  "match_play",
  "better_ball",
  "pairs_stableford",
  "team_stableford",
]);

const stableford = (gross, par, shots) =>
  gross
    ? Math.max(0, 2 + Number(par) + Number(shots) - Number(gross))
    : 0;

const strokesOnHole = (handicap, si) => {
  const h = Math.max(0, Number(handicap || 0));
  return Math.floor(h / 18) + (Number(si) <= h % 18 ? 1 : 0);
};

const playingHcp = (index, round) => {
  if (!round) return 0;

  if (round.course_key === "resort") {
    return Math.round(Number(index || 0));
  }

  const slope = Number(round.slope || 113);
  const rating = Number(round.course_rating || round.par);
  const par = Number(round.par);

  const courseHcp = Math.round(
    Number(index || 0) * (slope / 113) + (rating - par)
  );

  return Math.round(courseHcp * Number(round.allowance || 0.95));
};

const dateLabel = (date) => {
  const [y, m, d] = String(date).split("-").map(Number);
  if (!y || !m || !d) return date;

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, d));
};

function PlayerPhoto({ name, size = 42, gold = false }) {
  const [failed, setFailed] = useState(false);
  const photo = PLAYER_PHOTOS[name];

  if (!photo || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: "50%",
          background: "linear-gradient(145deg,#315c40,#173723)",
          border: gold ? "2px solid #d9b65c" : "1px solid #496553",
          display: "grid",
          placeItems: "center",
          fontSize: Math.max(14, size * 0.36),
          fontWeight: 900,
        }}
      >
        {name?.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={photo}
      alt={name}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: gold ? "2px solid #d9b65c" : "1px solid #496553",
      }}
    />
  );
}

function HoleVisual({ hole }) {
  const text = String(hole?.overview || "").toLowerCase();
  const hazards = [];

  if (
    text.includes("water") ||
    text.includes("lake") ||
    text.includes("pond")
  ) {
    hazards.push("💧 Water");
  }

  if (text.includes("bunker") || text.includes("sand")) {
    hazards.push("⛱️ Bunkers");
  }

  if (text.includes("dogleg")) hazards.push("↪️ Dogleg");
  if (text.includes("tree")) hazards.push("🌲 Trees");

  return (
    <div style={styles.holeVisual}>
      <div style={styles.green}>⛳ GREEN</div>

      <div style={styles.fairway}>
        <span>{hole.yellow_metres}m</span>

        {hazards.map((hazard) => (
          <b key={hazard} style={styles.hazard}>
            {hazard}
          </b>
        ))}
      </div>

      <div style={styles.tee}>● YELLOW TEE</div>

      <small style={styles.visualNote}>
        Schematic hole guide • not to scale
      </small>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [holes, setHoles] = useState([]);
  const [scores, setScores] = useState([]);
  const [competitions, setCompetitions] = useState([]);

  const [games, setGames] = useState([]);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [gameTeams, setGameTeams] = useState([]);

  const [roundId, setRoundId] = useState(null);
  const [holeNo, setHoleNo] = useState(1);
  const [scorecardPlayer, setScorecardPlayer] = useState("");
  const [leaderRound, setLeaderRound] = useState("overall");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [gameRoundId, setGameRoundId] = useState(null);
  const [gameType, setGameType] = useState("skins");
  const [gameName, setGameName] = useState("");
  const [gameScoring, setGameScoring] = useState("net");
  const [carryovers, setCarryovers] = useState(true);
  const [skinValue, setSkinValue] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [teamMap, setTeamMap] = useState({});
  const [bestScoresCount, setBestScoresCount] = useState(2);
  const [savingGame, setSavingGame] = useState(false);

  async function loadApp(showLoader = true) {
    if (showLoader) setLoading(true);
    setMessage("");

    const [p, r, h, s, c, g, gp, gt] = await Promise.all([
      supabase.from("players").select("name, handicap").order("name"),
      supabase.from("pm_rounds").select("*").order("round_no"),
      supabase.from("pm_holes").select("*").order("course_key, hole_no"),
      supabase.from("pm_scores").select("*"),
      supabase.from("pm_competitions").select("*"),
      supabase.from("pm_games").select("*").order("created_at"),
      supabase.from("pm_game_players").select("*"),
      supabase.from("pm_game_teams").select("*"),
    ]);

    const error =
      p.error ||
      r.error ||
      h.error ||
      s.error ||
      c.error ||
      g.error ||
      gp.error ||
      gt.error;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setPlayers(p.data || []);
    setRounds(r.data || []);
    setHoles(h.data || []);
    setScores(s.data || []);
    setCompetitions(c.data || []);
    setGames(g.data || []);
    setGamePlayers(gp.data || []);
    setGameTeams(gt.data || []);

    if (r.data?.length) {
      setRoundId((old) => old || r.data[0].id);
      setGameRoundId((old) => old || r.data[0].id);
    }

    if (p.data?.length) {
      setScorecardPlayer((old) => old || p.data[0].name);

      setSelectedPlayers((old) =>
        old.length ? old : p.data.map((x) => x.name)
      );

      setTeamMap((old) =>
        Object.keys(old).length
          ? old
          : Object.fromEntries(
              p.data.map((x, i) => [x.name, (i % 2) + 1])
            )
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadApp();
  }, []);

  const round =
    rounds.find((r) => r.id === roundId) || rounds[0];

  const hole = holes.find(
    (h) =>
      h.course_key === round?.course_key &&
      Number(h.hole_no) === holeNo
  );

  function getScore(playerName, r = round, number = holeNo) {
    if (!r) return null;

    return scores.find(
      (s) =>
        s.round_id === r.id &&
        s.player_name === playerName &&
        Number(s.hole_no) === Number(number)
    );
  }

  async function saveScore(playerName, field, value) {
    if (!round) return;

    const current = getScore(playerName) || {};

    const payload = {
      round_id: round.id,
      player_name: playerName,
      hole_no: holeNo,
      gross:
        field === "gross"
          ? value
          : current.gross ?? null,
      putts:
        field === "putts"
          ? value
          : current.putts ?? null,
      updated_at: new Date().toISOString(),
    };

    setScores((old) => [
      ...old.filter(
        (s) =>
          !(
            s.round_id === round.id &&
            s.player_name === playerName &&
            Number(s.hole_no) === holeNo
          )
      ),
      payload,
    ]);

    const { error } = await supabase
      .from("pm_scores")
      .upsert(payload, {
        onConflict: "round_id,player_name,hole_no",
      });

    if (error) {
      setMessage(`Score not saved: ${error.message}`);
      await loadApp(false);
    }
  }

  function calculatePlayer(player, selectedRounds = rounds) {
    let points = 0;
    let gross = 0;
    let putts = 0;
    let holesPlayed = 0;
    let birdies = 0;
    let pars = 0;

    selectedRounds.forEach((r) => {
      const ph = playingHcp(player.handicap, r);

      holes
        .filter((h) => h.course_key === r.course_key)
        .forEach((h) => {
          const score = getScore(
            player.name,
            r,
            h.hole_no
          );

          if (score?.gross) {
            const g = Number(score.gross);
            const shots = strokesOnHole(
              ph,
              h.stroke_index
            );

            holesPlayed++;
            gross += g;
            putts += Number(score.putts || 0);
            points += stableford(g, h.par, shots);

            if (g <= Number(h.par) - 1) birdies++;
            if (g === Number(h.par)) pars++;
          }
        });
    });

    return {
      ...player,
      points,
      gross,
      putts,
      holesPlayed,
      birdies,
      pars,
    };
  }

  const overallLeaderboard = useMemo(
    () =>
      players
        .map((p) => calculatePlayer(p, rounds))
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.birdies - a.birdies ||
            a.putts - b.putts
        ),
    [players, rounds, holes, scores]
  );

  const selectedLeaderboard = useMemo(() => {
    if (leaderRound === "overall")
      return overallLeaderboard;

    const selected = rounds.find(
      (r) => r.id === leaderRound
    );

    if (!selected) return overallLeaderboard;

    return players
      .map((p) => calculatePlayer(p, [selected]))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.birdies - a.birdies ||
          a.putts - b.putts
      );
  }, [
    leaderRound,
    overallLeaderboard,
    players,
    rounds,
    holes,
    scores,
  ]);

  function roundStats(name, r) {
    const player = players.find(
      (x) => x.name === name
    );

    return player
      ? calculatePlayer(player, [r])
      : {
          points: 0,
          gross: 0,
          putts: 0,
          holesPlayed: 0,
        };
  }

  const mostBirdies = [...overallLeaderboard].sort(
    (a, b) => b.birdies - a.birdies
  )[0];

  const completedPutters =
    overallLeaderboard.filter(
      (p) => p.holesPlayed > 0
    );

  const fewestPutts = [...completedPutters].sort(
    (a, b) => a.putts - b.putts
  )[0];

  const woodenSpoon =
    overallLeaderboard
      .filter((p) => p.holesPlayed > 0)
      .slice(-1)[0];

  async function updateHandicap(name, value) {
    if (value === "") return;

    const handicap = Number(value);

    setPlayers((old) =>
      old.map((p) =>
        p.name === name
          ? { ...p, handicap }
          : p
      )
    );

    const { error } = await supabase
      .from("players")
      .update({ handicap })
      .eq("name", name);

    if (error) {
      setMessage(
        `Handicap not saved: ${error.message}`
      );
      await loadApp(false);
    }
  }

  function competitionFor(r, type) {
    return competitions.find(
      (c) =>
        c.round_id === r.id &&
        c.competition_type === type
    );
  }

  async function updateCompetition(
    r,
    type,
    field,
    value
  ) {
    const existing = competitionFor(r, type);

    if (!existing) {
      setMessage(
        "Competition record not found."
      );
      return;
    }

    const update = {
      [field]:
        field === "hole_no"
          ? Number(value)
          : value || null,
      updated_at: new Date().toISOString(),
    };

    setCompetitions((old) =>
      old.map((c) =>
        c.id === existing.id
          ? { ...c, ...update }
          : c
      )
    );

    const { error } = await supabase
      .from("pm_competitions")
      .update(update)
      .eq("id", existing.id);

    if (error) {
      setMessage(
        `Competition not saved: ${error.message}`
      );
      await loadApp(false);
    }
  }

  const isTeamGame =
    TEAM_GAMES.has(gameType);

  function togglePlayer(name) {
    setSelectedPlayers((old) =>
      old.includes(name)
        ? old.filter((x) => x !== name)
        : [...old, name]
    );
  }

  async function createGame() {
    if (
      !gameRoundId ||
      selectedPlayers.length < 2
    ) {
      setMessage(
        "Choose a round and at least two players."
      );
      return;
    }

    if (isTeamGame) {
      const teams = new Set(
        selectedPlayers.map((name) =>
          Number(teamMap[name] || 1)
        )
      );

      if (teams.size < 2) {
        setMessage(
          "Team games need players on both Team A and Team B."
        );
        return;
      }
    }

    setSavingGame(true);
    setMessage("");

    const payload = {
      round_id: gameRoundId,
      game_name:
        gameName.trim() ||
        GAME_LABELS[gameType],
      game_type: gameType,
      scoring_type: gameScoring,
      carryovers:
        gameType === "skins"
          ? carryovers
          : false,
      skin_value:
        gameType === "skins" &&
        skinValue !== ""
          ? Number(skinValue)
          : null,
      currency,
      best_scores_count:
        gameType === "team_stableford"
          ? Number(bestScoresCount)
          : 1,
      is_active: true,
    };

    const { data: game, error } =
      await supabase
        .from("pm_games")
        .insert(payload)
        .select()
        .single();

    if (error) {
      setMessage(
        `Game not created: ${error.message}`
      );
      setSavingGame(false);
      return;
    }

    const playerRows =
      selectedPlayers.map((name) => ({
        game_id: game.id,
        team_no: isTeamGame
          ? Number(teamMap[name] || 1)
          : 1,
        player_name: name,
      }));

    const { error: playerError } =
      await supabase
        .from("pm_game_players")
        .insert(playerRows);

    let teamError = null;

    if (isTeamGame) {
      const response = await supabase
        .from("pm_game_teams")
        .insert([
          {
            game_id: game.id,
            team_no: 1,
            team_name: "Team A",
          },
          {
            game_id: game.id,
            team_no: 2,
            team_name: "Team B",
          },
        ]);

      teamError = response.error;
    }

    if (playerError || teamError) {
      setMessage(
        `Game created, but setup failed: ${
          (playerError || teamError).message
        }`
      );
    } else {
      setGameName("");
      setSkinValue("");
      setMessage("Game created.");
    }

    await loadApp(false);
    setSavingGame(false);
  }

  async function deleteGame(id) {
    if (!window.confirm("Delete this game?"))
      return;

    const { error } = await supabase
      .from("pm_games")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(
        `Game not deleted: ${error.message}`
      );
    } else {
      await loadApp(false);
    }
  }

  function gameMembers(game) {
    return gamePlayers.filter(
      (x) => x.game_id === game.id
    );
  }

  function adjustedStroke(
    name,
    r,
    h,
    scoring
  ) {
    const score = getScore(
      name,
      r,
      h.hole_no
    );

    if (!score?.gross) return null;

    if (scoring === "gross") {
      return Number(score.gross);
    }

    const player = players.find(
      (x) => x.name === name
    );

    const ph = playingHcp(
      player?.handicap,
      r
    );

    const shots = strokesOnHole(
      ph,
      h.stroke_index
    );

    return Number(score.gross) - shots;
  }

  function gameStableford(
    name,
    r,
    h,
    scoring
  ) {
    const score = getScore(
      name,
      r,
      h.hole_no
    );

    if (!score?.gross) return null;

    const player = players.find(
      (x) => x.name === name
    );

    const shots =
      scoring === "net"
        ? strokesOnHole(
            playingHcp(
              player?.handicap,
              r
            ),
            h.stroke_index
          )
        : 0;

    return stableford(
      Number(score.gross),
      h.par,
      shots
    );
  }

  function gameResult(game) {
    const r = rounds.find(
      (x) => x.id === game.round_id
    );

    if (!r) return null;

    const courseHoles = holes
      .filter(
        (h) =>
          h.course_key === r.course_key
      )
      .sort(
        (a, b) =>
          a.hole_no - b.hole_no
      );

    const members = gameMembers(game);

    if (game.game_type === "skins") {
      const won = Object.fromEntries(
        members.map((m) => [
          m.player_name,
          0,
        ])
      );

      let carry = 0;
      let completed = 0;
      const detail = [];

      courseHoles.forEach((h) => {
        const values = members.map(
          (m) => ({
            name: m.player_name,
            value: adjustedStroke(
              m.player_name,
              r,
              h,
              game.scoring_type
            ),
          })
        );

        if (
          values.some(
            (x) => x.value == null
          )
        ) {
          return;
        }

        completed++;

        const lowest = Math.min(
          ...values.map((x) => x.value)
        );

        const winners = values.filter(
          (x) => x.value === lowest
        );

        if (winners.length === 1) {
          const skins =
            1 +
            (game.carryovers
              ? carry
              : 0);

          won[winners[0].name] +=
            skins;

          detail.push(
            `H${h.hole_no}: ${winners[0].name} +${skins}`
          );

          carry = 0;
        } else {
          if (game.carryovers) {
            carry++;
          }

          detail.push(
            `H${h.hole_no}: tied${
              game.carryovers
                ? " • carry"
                : ""
            }`
          );
        }
      });

      return {
        kind: "skins",
        won,
        carry,
        completed,
        detail,
      };
    }

    const teams = [1, 2];

    const totals = {
      1: 0,
      2: 0,
    };

    const holesWon = {
      1: 0,
      2: 0,
    };

    let completed = 0;

    courseHoles.forEach((h) => {
      const teamValues = {};

      teams.forEach((team) => {
        const names = members
          .filter(
            (m) =>
              Number(m.team_no) ===
              team
          )
          .map(
            (m) => m.player_name
          );

        if (
          game.game_type ===
          "better_ball"
        ) {
          teamValues[team] =
            names
              .map((name) =>
                adjustedStroke(
                  name,
                  r,
                  h,
                  game.scoring_type
                )
              )
              .filter(
                (value) =>
                  value != null
              )
              .sort(
                (a, b) => a - b
              )[0] ?? null;
        } else {
          const points = names
            .map((name) =>
              gameStableford(
                name,
                r,
                h,
                game.scoring_type
              )
            )
            .filter(
              (value) =>
                value != null
            )
            .sort(
              (a, b) => b - a
            );

          if (!points.length) {
            teamValues[team] =
              null;
          } else if (
            game.game_type ===
            "pairs_stableford"
          ) {
            teamValues[team] =
              points.reduce(
                (a, b) => a + b,
                0
              );
          } else {
            teamValues[team] =
              points
                .slice(
                  0,
                  Math.max(
                    1,
                    Number(
                      game.best_scores_count ||
                        1
                    )
                  )
                )
                .reduce(
                  (a, b) =>
                    a + b,
                  0
                );
          }
        }
      });

      if (
        teamValues[1] == null ||
        teamValues[2] == null
      ) {
        return;
      }

      completed++;

      if (
        game.game_type ===
          "match_play" ||
        game.game_type ===
          "better_ball"
      ) {
        if (
          teamValues[1] <
          teamValues[2]
        ) {
          holesWon[1]++;
        } else if (
          teamValues[2] <
          teamValues[1]
        ) {
          holesWon[2]++;
        }
      } else {
        totals[1] +=
          teamValues[1];

        totals[2] +=
          teamValues[2];
      }
    });

    if (
      game.game_type ===
        "match_play" ||
      game.game_type ===
        "better_ball"
    ) {
      return {
        kind: "match",
        holesWon,
        completed,
      };
    }

    return {
      kind: "points",
      totals,
      completed,
    };
  }

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.loading}>
          <div style={styles.logoBall}>
            ⛳
          </div>

          <h1>
            Portugal Masters 2026
          </h1>

          <p style={styles.muted}>
            Loading the tournament...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              PENINA • ALGARVE • PORTUGAL
            </div>

            <h1 style={styles.title}>
              Portugal{" "}
              <span style={styles.gold}>
                Masters
              </span>
              <span style={styles.year}>
                {" "}2026
              </span>
            </h1>
          </div>

          <div style={styles.badge}>
            🏆 3-Day Stableford
          </div>
        </header>

        {message && (
          <div style={styles.message}>
            {message}

            <button
              style={styles.messageClose}
              onClick={() =>
                setMessage("")
              }
            >
              ×
            </button>
          </div>
        )}

        <nav style={styles.nav}>
          {[
            ["home", "🏠 Trip"],
            ["play", "⛳ Score"],
            [
              "leaderboard",
              "🏆 Leaderboard",
            ],
            [
              "scorecards",
              "📋 Scorecards",
            ],
            [
              "competitions",
              "🎯 Competitions",
            ],
            ["games", "🎲 Games"],
            ["admin", "⚙️ Admin"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setTab(key)
              }
              style={{
                ...styles.navButton,
                ...(tab === key
                  ? styles.active
                  : {}),
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "home" && (
          <>
            <section
              style={{
                ...styles.hero,
                backgroundImage: `linear-gradient(90deg,rgba(3,10,6,.93) 0%,rgba(3,10,6,.70) 43%,rgba(3,10,6,.15) 100%), url("${HERO_IMAGE}")`,
              }}
            >
              <div
                style={styles.heroShade}
              >
                <div
                  style={styles.eyebrow}
                >
                  1–3 OCTOBER 2026
                </div>

                <h2
                  style={styles.heroTitle}
                >
                  Three rounds.
                  <br />
                  Six mates.
                  <br />
                  One champion.
                </h2>

                <p style={styles.heroText}>
                  Penina • Algarve
                  <br />
                  The Portugal Masters
                  2026
                </p>

                <button
                  style={styles.primary}
                  onClick={() =>
                    setTab("play")
                  }
                >
                  Start scoring →
                </button>
              </div>
            </section>

            <section
              style={styles.quickStats}
            >
              {[
                [3, "ROUNDS"],
                [54, "HOLES"],
                [6, "PLAYERS"],
                [1, "CHAMPION"],
              ].map(([number, label]) => (
                <div
                  key={label}
                  style={styles.statBox}
                >
                  <b>{number}</b>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            <div
              style={
                styles.sectionHeading
              }
            >
              <div>
                <div
                  style={styles.eyebrow}
                >
                  THE ITINERARY
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Three days at Penina
                </h2>
              </div>
            </div>

            <div style={styles.cards}>
              {rounds.map((r) => (
                <div
                  key={r.id}
                  style={styles.roundCard}
                >
                  <div
                    style={
                      styles.roundNumber
                    }
                  >
                    0{r.round_no}
                  </div>

                  <div
                    style={styles.eyebrow}
                  >
                    {dateLabel(
                      r.play_date
                    )}
                  </div>

                  <h3
                    style={styles.cardTitle}
                  >
                    {r.course_name}
                  </h3>

                  <div
                    style={
                      styles.roundMeta
                    }
                  >
                    <span>
                      ⏰ {r.tee_time}
                    </span>
                    <span>
                      🟡 Yellow
                    </span>
                    <span>
                      Par {r.par}
                    </span>
                  </div>

                  <button
                    style={
                      styles.secondary
                    }
                    onClick={() => {
                      setRoundId(r.id);
                      setHoleNo(1);
                      setTab("play");
                    }}
                  >
                    Open round →
                  </button>
                </div>
              ))}
            </div>

            <div
              style={
                styles.sectionHeading
              }
            >
              <div>
                <div
                  style={styles.eyebrow}
                >
                  THE FIELD
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  The Players
                </h2>
              </div>
            </div>

            <div
              style={styles.playerGrid}
            >
              {players.map((player) => (
                <div
                  key={player.name}
                  style={
                    styles.playerCard
                  }
                >
                  <PlayerPhoto
                    name={player.name}
                    size={70}
                    gold
                  />

                  <div>
                    <h3
                      style={
                        styles.playerName
                      }
                    >
                      {player.name}
                    </h3>

                    <div
                      style={
                        styles.handicapPill
                      }
                    >
                      HCP{" "}
                      {player.handicap}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "play" &&
          round &&
          hole && (
            <>
              <div
                style={styles.pageTop}
              >
                <div>
                  <div
                    style={
                      styles.eyebrow
                    }
                  >
                    LIVE SCORING
                  </div>

                  <h2
                    style={
                      styles.sectionTitle
                    }
                  >
                    Enter Scores
                  </h2>
                </div>

                <select
                  value={round.id}
                  onChange={(e) => {
                    setRoundId(
                      e.target.value
                    );
                    setHoleNo(1);
                  }}
                  style={styles.select}
                >
                  {rounds.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                    >
                      Round{" "}
                      {r.round_no} —{" "}
                      {r.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <section
                style={styles.holeCard}
              >
                <div
                  style={
                    styles.holeHeader
                  }
                >
                  <div>
                    <div
                      style={
                        styles.eyebrow
                      }
                    >
                      HOLE
                    </div>

                    <div
                      style={
                        styles.holeNumber
                      }
                    >
                      {holeNo}
                    </div>
                  </div>

                  <div
                    style={
                      styles.holeFacts
                    }
                  >
                    <div>
                      <small>PAR</small>
                      <b>{hole.par}</b>
                    </div>

                    <div>
                      <small>
                        YELLOW
                      </small>
                      <b>
                        {
                          hole.yellow_metres
                        }
                        m
                      </b>
                    </div>

                    <div>
                      <small>
                        STROKE INDEX
                      </small>
                      <b>
                        {
                          hole.stroke_index
                        }
                      </b>
                    </div>
                  </div>
                </div>

                <HoleVisual
                  hole={hole}
                />

                <details
                  open
                  style={styles.overview}
                >
                  <summary
                    style={
                      styles.summary
                    }
                  >
                    Hole overview &
                    strategy
                  </summary>

                  <p>{hole.overview}</p>
                </details>
              </section>

              <div
                style={
                  styles.scoringHeader
                }
              >
                <span>PLAYER</span>
                <span>GROSS</span>
                <span>PUTTS</span>
                <span>PTS</span>
              </div>

              {players.map((player) => {
                const score =
                  getScore(player.name) ||
                  {};

                const ph = playingHcp(
                  player.handicap,
                  round
                );

                const shots =
                  strokesOnHole(
                    ph,
                    hole.stroke_index
                  );

                const points =
                  stableford(
                    score.gross,
                    hole.par,
                    shots
                  );

                return (
                  <div
                    key={player.name}
                    style={
                      styles.scoreRow
                    }
                  >
                    <div
                      style={
                        styles.scorePlayer
                      }
                    >
                      <PlayerPhoto
                        name={
                          player.name
                        }
                        size={38}
                      />

                      <div
                        style={
                          styles.scorePlayerText
                        }
                      >
                        <b>
                          {
                            player.name
                          }
                        </b>

                        <small>
                          PH {ph} •{" "}
                          {shots} shot
                          {shots === 1
                            ? ""
                            : "s"}{" "}
                          here
                        </small>
                      </div>
                    </div>

                    <input
                      type="number"
                      min="1"
                      max="20"
                      inputMode="numeric"
                      value={
                        score.gross ??
                        ""
                      }
                      onChange={(e) =>
                        saveScore(
                          player.name,
                          "gross",
                          e.target
                            .value === ""
                            ? null
                            : Number(
                                e.target
                                  .value
                              )
                        )
                      }
                      style={
                        styles.scoreInput
                      }
                    />

                    <input
                      type="number"
                      min="0"
                      max="10"
                      inputMode="numeric"
                      value={
                        score.putts ??
                        ""
                      }
                      onChange={(e) =>
                        saveScore(
                          player.name,
                          "putts",
                          e.target
                            .value === ""
                            ? null
                            : Number(
                                e.target
                                  .value
                              )
                        )
                      }
                      style={
                        styles.scoreInput
                      }
                    />

                    <div
                      style={
                        styles.points
                      }
                    >
                      {score.gross
                        ? points
                        : "–"}
                      <small>PTS</small>
                    </div>
                  </div>
                );
              })}

              <div
                style={styles.holeNav}
              >
                <button
                  disabled={holeNo === 1}
                  style={{
                    ...styles.secondary,
                    opacity:
                      holeNo === 1
                        ? 0.4
                        : 1,
                  }}
                  onClick={() =>
                    setHoleNo((n) =>
                      Math.max(
                        1,
                        n - 1
                      )
                    )
                  }
                >
                  ← Previous
                </button>

                <div
                  style={
                    styles.holeProgress
                  }
                >
                  Hole <b>{holeNo}</b>{" "}
                  of 18
                </div>

                <button
                  disabled={
                    holeNo === 18
                  }
                  style={{
                    ...styles.primary,
                    opacity:
                      holeNo === 18
                        ? 0.4
                        : 1,
                  }}
                  onClick={() =>
                    setHoleNo((n) =>
                      Math.min(
                        18,
                        n + 1
                      )
                    )
                  }
                >
                  Next →
                </button>
              </div>

              <div
                style={
                  styles.holePicker
                }
              >
                {Array.from(
                  { length: 18 },
                  (_, i) => i + 1
                ).map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      setHoleNo(n)
                    }
                    style={{
                      ...styles.holeButton,
                      ...(holeNo === n
                        ? styles.holeButtonActive
                        : {}),
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}

        {tab === "leaderboard" && (
          <>
            <div
              style={styles.pageTop}
            >
              <div>
                <div
                  style={styles.eyebrow}
                >
                  LIVE
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Leaderboard
                </h2>
              </div>

              <select
                value={leaderRound}
                onChange={(e) =>
                  setLeaderRound(
                    e.target.value
                  )
                }
                style={styles.select}
              >
                <option value="overall">
                  Overall — 3 Rounds
                </option>

                {rounds.map((r) => (
                  <option
                    key={r.id}
                    value={r.id}
                  >
                    Round {r.round_no}
                  </option>
                ))}
              </select>
            </div>

            {selectedLeaderboard.map(
              (player, index) => (
                <div
                  key={player.name}
                  style={{
                    ...styles.leaderRow,
                    ...(index === 0
                      ? styles.leaderFirst
                      : {}),
                  }}
                >
                  <div
                    style={
                      styles.position
                    }
                  >
                    {index === 0
                      ? "🏆"
                      : index + 1}
                  </div>

                  <PlayerPhoto
                    name={player.name}
                    size={42}
                    gold={index === 0}
                  />

                  <div>
                    <b
                      style={
                        styles.leaderName
                      }
                    >
                      {player.name}
                    </b>

                    <div
                      style={
                        styles.muted
                      }
                    >
                      {
                        player.holesPlayed
                      }{" "}
                      holes •{" "}
                      {player.birdies}{" "}
                      birdies •{" "}
                      {player.putts}{" "}
                      putts
                    </div>
                  </div>

                  <div
                    style={styles.total}
                  >
                    {player.points}
                    <small>PTS</small>
                  </div>
                </div>
              )
            )}

            <div
              style={
                styles.sectionHeading
              }
            >
              <div>
                <div
                  style={styles.eyebrow}
                >
                  TOURNAMENT AWARDS
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Current Leaders
                </h2>
              </div>
            </div>

            <div
              style={styles.awardGrid}
            >
              <Award
                icon="🐦"
                title="Most Birdies"
                player={
                  mostBirdies?.holesPlayed
                    ? mostBirdies.name
                    : "—"
                }
                detail={
                  mostBirdies?.holesPlayed
                    ? `${mostBirdies.birdies} birdies`
                    : ""
                }
              />

              <Award
                icon="🏌️"
                title="Fewest Putts"
                player={
                  fewestPutts?.name ||
                  "—"
                }
                detail={
                  fewestPutts
                    ? `${fewestPutts.putts} putts`
                    : ""
                }
              />

              <Award
                icon="🥄"
                title="Wooden Spoon"
                player={
                  woodenSpoon?.name ||
                  "—"
                }
                detail={
                  woodenSpoon
                    ? `${woodenSpoon.points} points`
                    : ""
                }
              />
            </div>
          </>
        )}
        {tab === "scorecards" && (
          <>
            <div style={styles.pageTop}>
              <div>
                <div style={styles.eyebrow}>PLAYER RECORD</div>
                <h2 style={styles.sectionTitle}>Scorecards</h2>
              </div>

              <select
                value={scorecardPlayer}
                onChange={(e) => setScorecardPlayer(e.target.value)}
                style={styles.select}
              >
                {players.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {scorecardPlayer && (
              <div style={styles.scorecardPlayerHeader}>
                <PlayerPhoto name={scorecardPlayer} size={54} gold />
                <div>
                  <div style={styles.eyebrow}>PLAYER</div>
                  <b style={styles.scorecardPlayerName}>{scorecardPlayer}</b>
                </div>
              </div>
            )}

            {rounds.map((r) => {
              const stats = roundStats(scorecardPlayer, r);
              const player = players.find((p) => p.name === scorecardPlayer);
              const ph = playingHcp(player?.handicap, r);

              const courseHoles = holes
                .filter((h) => h.course_key === r.course_key)
                .sort((a, b) => Number(a.hole_no) - Number(b.hole_no));

              return (
                <section key={r.id} style={styles.scorecard}>
                  <div style={styles.scorecardTop}>
                    <div>
                      <div style={styles.eyebrow}>ROUND {r.round_no}</div>
                      <h3 style={styles.cardTitle}>{r.course_name}</h3>
                    </div>

                    <div style={styles.scorecardTotal}>
                      {stats.points}
                      <small>PTS</small>
                    </div>
                  </div>

                  <div style={styles.scorecardSummary}>
                    <span>Playing HCP {ph}</span>
                    <span>{stats.holesPlayed}/18 played</span>
                    <span>{stats.putts} putts</span>
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Hole</th>
                          <th>Par</th>
                          <th>SI</th>
                          <th>Gross</th>
                          <th>Putts</th>
                          <th>Pts</th>
                        </tr>
                      </thead>

                      <tbody>
                        {courseHoles.map((h) => {
                          const score = getScore(
                            scorecardPlayer,
                            r,
                            h.hole_no
                          );

                          const shots = strokesOnHole(ph, h.stroke_index);

                          return (
                            <tr key={h.hole_no}>
                              <td>{h.hole_no}</td>
                              <td>{h.par}</td>
                              <td>{h.stroke_index}</td>
                              <td>{score?.gross ?? "–"}</td>
                              <td>{score?.putts ?? "–"}</td>
                              <td>
                                {score?.gross
                                  ? stableford(score.gross, h.par, shots)
                                  : "–"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </>
        )}

        {tab === "competitions" && (
          <>
            <div style={styles.eyebrow}>SIDE CONTESTS</div>
            <h2 style={styles.sectionTitle}>Nearest & Longest</h2>

            <p style={styles.intro}>
              Set the competition hole for each round, then select the winner
              when the group has completed it.
            </p>

            {rounds.map((r) => {
              const ntp = competitionFor(r, "nearest_pin");
              const ld = competitionFor(r, "longest_drive");

              return (
                <section key={r.id} style={styles.competitionCard}>
                  <div style={styles.eyebrow}>ROUND {r.round_no}</div>
                  <h3 style={styles.cardTitle}>{r.course_name}</h3>

                  <CompetitionEditor
                    icon="🎯"
                    title="Nearest the Pin"
                    competition={ntp}
                    players={players}
                    onHole={(value) =>
                      updateCompetition(r, "nearest_pin", "hole_no", value)
                    }
                    onPlayer={(value) =>
                      updateCompetition(r, "nearest_pin", "player_name", value)
                    }
                  />

                  <CompetitionEditor
                    icon="💥"
                    title="Longest Drive"
                    competition={ld}
                    players={players}
                    onHole={(value) =>
                      updateCompetition(r, "longest_drive", "hole_no", value)
                    }
                    onPlayer={(value) =>
                      updateCompetition(r, "longest_drive", "player_name", value)
                    }
                  />
                </section>
              );
            })}
          </>
        )}

        {tab === "games" && (
          <>
            <div style={styles.pageTop}>
              <div>
                <div style={styles.eyebrow}>GROUPS & SIDE GAMES</div>
                <h2 style={styles.sectionTitle}>Games</h2>
              </div>

              <button style={styles.secondary} onClick={() => loadApp(false)}>
                ↻ Refresh
              </button>
            </div>

            <p style={styles.intro}>
              Create the game when you know the groups. Scores are taken
              automatically from the main scorecard, so nobody enters a score
              twice.
            </p>

            <section style={styles.gameSetup}>
              <div style={styles.eyebrow}>NEW GAME</div>
              <h3 style={styles.cardTitle}>Set up a side game</h3>

              <div style={styles.formGrid}>
                <label style={styles.formLabel}>
                  Round
                  <select
                    value={gameRoundId || ""}
                    onChange={(e) => setGameRoundId(e.target.value)}
                    style={styles.formControl}
                  >
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        Round {r.round_no} — {r.course_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.formLabel}>
                  Game
                  <select
                    value={gameType}
                    onChange={(e) => setGameType(e.target.value)}
                    style={styles.formControl}
                  >
                    <option value="skins">Skins</option>
                    <option value="match_play">Match Play</option>
                    <option value="better_ball">Better Ball</option>
                    <option value="pairs_stableford">Pairs Stableford</option>
                    <option value="team_stableford">Team Stableford</option>
                  </select>
                </label>

                <label style={styles.formLabel}>
                  Name
                  <input
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder={GAME_LABELS[gameType]}
                    style={styles.formControl}
                  />
                </label>

                <label style={styles.formLabel}>
                  Scoring
                  <select
                    value={gameScoring}
                    onChange={(e) => setGameScoring(e.target.value)}
                    style={styles.formControl}
                  >
                    <option value="net">Net</option>
                    <option value="gross">Gross</option>
                  </select>
                </label>
              </div>

              {gameType === "skins" && (
                <div style={styles.formGrid}>
                  <label style={styles.formLabel}>
                    Carryovers
                    <select
                      value={carryovers ? "yes" : "no"}
                      onChange={(e) => setCarryovers(e.target.value === "yes")}
                      style={styles.formControl}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>

                  <label style={styles.formLabel}>
                    Currency
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      style={styles.formControl}
                    >
                      <option value="GBP">£ GBP</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                  </label>

                  <label style={styles.formLabel}>
                    Value per skin
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={skinValue}
                      onChange={(e) => setSkinValue(e.target.value)}
                      placeholder="Optional"
                      style={styles.formControl}
                    />
                  </label>
                </div>
              )}

              {gameType === "team_stableford" && (
                <label style={styles.formLabel}>
                  Best scores counting per hole
                  <select
                    value={bestScoresCount}
                    onChange={(e) => setBestScoresCount(Number(e.target.value))}
                    style={styles.formControl}
                  >
                    <option value={1}>Best 1</option>
                    <option value={2}>Best 2</option>
                    <option value={3}>Best 3</option>
                  </select>
                </label>
              )}

              <div style={styles.gameSubheading}>Players</div>

              <div style={styles.gamePlayerGrid}>
                {players.map((player) => {
                  const selected = selectedPlayers.includes(player.name);

                  return (
                    <div
                      key={player.name}
                      style={{
                        ...styles.gamePlayer,
                        ...(selected ? styles.gamePlayerSelected : {}),
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => togglePlayer(player.name)}
                        style={styles.playerToggle}
                      >
                        <PlayerPhoto name={player.name} size={38} />
                        <span>
                          <b>{player.name}</b>
                          <small>{selected ? "✓ Playing" : "Tap to add"}</small>
                        </span>
                      </button>

                      {selected && isTeamGame && (
                        <div style={styles.teamButtons}>
                          <button
                            type="button"
                            onClick={() =>
                              setTeamMap((old) => ({
                                ...old,
                                [player.name]: 1,
                              }))
                            }
                            style={{
                              ...styles.teamButton,
                              ...(Number(teamMap[player.name] || 1) === 1
                                ? styles.teamButtonActive
                                : {}),
                            }}
                          >
                            A
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setTeamMap((old) => ({
                                ...old,
                                [player.name]: 2,
                              }))
                            }
                            style={{
                              ...styles.teamButton,
                              ...(Number(teamMap[player.name] || 1) === 2
                                ? styles.teamButtonActive
                                : {}),
                            }}
                          >
                            B
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                style={{
                  ...styles.primary,
                  width: "100%",
                  marginTop: 14,
                  opacity: savingGame ? 0.6 : 1,
                }}
                disabled={savingGame}
                onClick={createGame}
              >
                {savingGame ? "Creating..." : "Create Game"}
              </button>
            </section>

            <div style={styles.sectionHeading}>
              <div>
                <div style={styles.eyebrow}>LIVE GAMES</div>
                <h2 style={styles.sectionTitle}>Current Games</h2>
              </div>
            </div>

            {!games.length && (
              <div style={styles.emptyState}>
                No games created yet. Set one up above when the groups are
                decided.
              </div>
            )}

            {games.map((game) => {
              const r = rounds.find((x) => x.id === game.round_id);
              const members = gameMembers(game);
              const result = gameResult(game);

              const teamA = members
                .filter((m) => Number(m.team_no) === 1)
                .map((m) => m.player_name);

              const teamB = members
                .filter((m) => Number(m.team_no) === 2)
                .map((m) => m.player_name);

              return (
                <section key={game.id} style={styles.gameCard}>
                  <div style={styles.gameCardTop}>
                    <div>
                      <div style={styles.eyebrow}>
                        ROUND {r?.round_no || "—"} •{" "}
                        {String(game.scoring_type || "net").toUpperCase()}
                      </div>

                      <h3 style={styles.gameTitle}>
                        {game.game_name || GAME_LABELS[game.game_type]}
                      </h3>

                      <div style={styles.gameType}>
                        {GAME_LABELS[game.game_type] || game.game_type}
                      </div>
                    </div>

                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteGame(game.id)}
                    >
                      Delete
                    </button>
                  </div>

                  {game.game_type === "skins" ? (
                    <>
                      <div style={styles.memberChips}>
                        {members.map((m) => (
                          <span key={m.id} style={styles.memberChip}>
                            {m.player_name}
                          </span>
                        ))}
                      </div>

                      <div style={styles.gameResultGrid}>
                        {Object.entries(result?.won || {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, count]) => (
                            <div key={name} style={styles.gameResultBox}>
                              <PlayerPhoto name={name} size={34} />
                              <b>{name}</b>
                              <strong>{count}</strong>
                              <small>
                                SKIN{count === 1 ? "" : "S"}
                              </small>

                              {game.skin_value != null && Number(game.skin_value) > 0 && (
                                <span style={styles.money}>
                                  {game.currency === "EUR" ? "€" : "£"}
                                  {(Number(count) * Number(game.skin_value)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>

                      <div style={styles.gameStatus}>
                        {result?.completed || 0}/18 holes completed
                        {result?.carry
                          ? ` • ${result.carry} skin${
                              result.carry === 1 ? "" : "s"
                            } currently carried`
                          : ""}
                      </div>

                      {!!result?.detail?.length && (
                        <details style={styles.gameDetails}>
                          <summary style={styles.summary}>
                            Hole-by-hole skins
                          </summary>

                          <div style={styles.detailList}>
                            {result.detail.map((line, index) => (
                              <span key={`${line}-${index}`}>{line}</span>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={styles.teamsDisplay}>
                        <div style={styles.teamCard}>
                          <div style={styles.eyebrow}>TEAM A</div>
                          <b>{teamA.join(" • ") || "—"}</b>
                        </div>

                        <div style={styles.vs}>VS</div>

                        <div style={styles.teamCard}>
                          <div style={styles.eyebrow}>TEAM B</div>
                          <b>{teamB.join(" • ") || "—"}</b>
                        </div>
                      </div>

                      {result?.kind === "match" && (
                        <div style={styles.matchScore}>
                          <div>
                            <strong>{result.holesWon[1]}</strong>
                            <span>TEAM A</span>
                          </div>

                          <b>HOLES WON</b>

                          <div>
                            <strong>{result.holesWon[2]}</strong>
                            <span>TEAM B</span>
                          </div>
                        </div>
                      )}

                      {result?.kind === "points" && (
                        <div style={styles.matchScore}>
                          <div>
                            <strong>{result.totals[1]}</strong>
                            <span>TEAM A</span>
                          </div>

                          <b>POINTS</b>

                          <div>
                            <strong>{result.totals[2]}</strong>
                            <span>TEAM B</span>
                          </div>
                        </div>
                      )}

                      <div style={styles.gameStatus}>
                        {result?.completed || 0}/18 holes scored
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </>
        )}

        {tab === "admin" && (
          <>
            <div style={styles.eyebrow}>TOURNAMENT CONTROL</div>
            <h2 style={styles.sectionTitle}>Admin</h2>

            <section style={styles.adminCard}>
              <h3>Player Handicaps</h3>

              <p style={styles.muted}>
                Resort rounds use these handicaps directly. Championship uses
                the course rating/slope calculation and 95% allowance.
              </p>

              {players.map((player) => (
                <div key={player.name} style={styles.adminRow}>
                  <div style={styles.adminPlayer}>
                    <PlayerPhoto name={player.name} size={38} />
                    <b>{player.name}</b>
                  </div>

                  <input
                    type="number"
                    step="0.1"
                    defaultValue={player.handicap}
                    onBlur={(e) =>
                      updateHandicap(player.name, e.target.value)
                    }
                    style={styles.adminInput}
                  />
                </div>
              ))}
            </section>

            <section style={styles.adminCard}>
              <h3>Competition Format</h3>

              <div style={styles.settingsGrid}>
                <Setting label="Main event" value="Individual Stableford" />
                <Setting label="Rounds counting" value="All 3" />
                <Setting label="Tees" value="Yellow" />
                <Setting label="Resort handicap" value="Stored HCP directly" />
                <Setting label="Championship" value="WHS + 95%" />
                <Setting label="Scoring" value="Gross + putts stored" />
              </div>
            </section>

            <section style={styles.adminCard}>
              <h3>Trip Schedule</h3>

              {rounds.map((r) => (
                <div key={r.id} style={styles.scheduleRow}>
                  <b>Round {r.round_no}</b>
                  <span>{dateLabel(r.play_date)}</span>
                  <span>{r.tee_time}</span>
                </div>
              ))}
            </section>
          </>
        )}

        <footer style={styles.footer}>
          PORTUGAL MASTERS 2026 • PENINA • ALGARVE
        </footer>
      </div>
    </main>
  );
}

function Award({ icon, title, player, detail }) {
  return (
    <div style={styles.award}>
      <div style={styles.awardIcon}>{icon}</div>
      <small>{title}</small>
      <b>{player}</b>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function CompetitionEditor({
  icon,
  title,
  competition,
  players,
  onHole,
  onPlayer,
}) {
  return (
    <div style={styles.competitionEditor}>
      <div style={styles.competitionIcon}>{icon}</div>

      <div style={styles.competitionBody}>
        <b>{title}</b>

        <div style={styles.competitionControls}>
          <label style={styles.controlLabel}>
            Hole
            <select
              value={competition?.hole_no || 1}
              onChange={(e) => onHole(e.target.value)}
              style={styles.smallSelect}
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.controlLabel}>
            Winner
            <select
              value={competition?.player_name || ""}
              onChange={(e) => onPlayer(e.target.value)}
              style={styles.winnerSelect}
            >
              <option value="">Not decided</option>

              {players.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function Setting({ label, value }) {
  return (
    <div style={styles.setting}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top,#173b28 0,#07140e 38%,#040b07 100%)",
    color: "#f8f4e8",
    fontFamily: "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "20px 14px 80px",
  },

  loading: {
    minHeight: "80vh",
    display: "grid",
    placeContent: "center",
    textAlign: "center",
  },

  logoBall: { fontSize: 45 },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#d9b65c",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 900,
    textTransform: "uppercase",
  },

  title: {
    fontSize: "clamp(30px,7vw,48px)",
    margin: "5px 0",
    letterSpacing: -1.5,
  },

  gold: { color: "#d9b65c" },
  year: { fontWeight: 300 },

  badge: {
    background: "rgba(16,38,26,.9)",
    border: "1px solid #3b5948",
    padding: "9px 13px",
    borderRadius: 30,
    fontWeight: 700,
  },

  nav: {
    display: "flex",
    gap: 7,
    overflowX: "auto",
    padding: "18px 0",
    WebkitOverflowScrolling: "touch",
  },

  navButton: {
    border: "1px solid #294b37",
    borderRadius: 30,
    padding: "10px 13px",
    background: "#0d2116",
    color: "#e9eee9",
    whiteSpace: "nowrap",
    fontWeight: 800,
  },

  active: {
    background: "#d9b65c",
    borderColor: "#d9b65c",
    color: "#07140e",
  },

  message: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    background: "#5a2727",
    border: "1px solid #9a5555",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },

  messageClose: {
    border: 0,
    background: "transparent",
    color: "white",
    fontSize: 20,
  },

  hero: {
    minHeight: 500,
    borderRadius: 25,
    backgroundSize: "cover",
    backgroundPosition: "center",
    border: "1px solid #3c644c",
    overflow: "hidden",
    boxShadow: "0 22px 55px rgba(0,0,0,.28)",
  },

  heroShade: {
    minHeight: 450,
    padding: "30px 22px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },

  heroTitle: {
    fontSize: "clamp(38px,10vw,64px)",
    lineHeight: 0.96,
    letterSpacing: -2,
    margin: "15px 0",
    textShadow: "0 3px 14px rgba(0,0,0,.65)",
  },

  heroText: {
    color: "#e0e7e1",
    lineHeight: 1.5,
    marginBottom: 24,
    textShadow: "0 2px 8px rgba(0,0,0,.8)",
  },

  primary: {
    border: 0,
    borderRadius: 11,
    padding: "13px 17px",
    background: "#d9b65c",
    color: "#07140e",
    fontWeight: 900,
    fontSize: 14,
  },

  secondary: {
    border: "1px solid #496553",
    borderRadius: 11,
    padding: "12px 15px",
    background: "#10261a",
    color: "white",
    fontWeight: 800,
  },

  quickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 7,
    marginTop: 10,
  },

  statBox: {
    background: "#0d2116",
    border: "1px solid #294b37",
    borderRadius: 13,
    padding: "14px 5px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
  },

  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginTop: 35,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 28,
    margin: "4px 0 10px",
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 10,
  },

  roundCard: {
    position: "relative",
    background: "linear-gradient(145deg,#112b1c,#0c1d14)",
    border: "1px solid #2c4d39",
    borderRadius: 18,
    padding: 18,
    overflow: "hidden",
  },

  roundNumber: {
    position: "absolute",
    right: 10,
    top: -8,
    fontSize: 72,
    fontWeight: 900,
    color: "rgba(217,182,92,.08)",
  },

  cardTitle: {
    fontSize: 19,
    margin: "8px 0 12px",
  },

  roundMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#b9c5bd",
    fontSize: 13,
    marginBottom: 17,
  },

  playerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 9,
  },

  playerCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 16,
    overflow: "hidden",
  },

  playerName: { margin: "0 0 5px" },

  handicapPill: {
    display: "inline-block",
    color: "#d9b65c",
    fontSize: 11,
    fontWeight: 900,
  },

  pageTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "end",
    flexWrap: "wrap",
  },

  select: {
    maxWidth: "100%",
    padding: 12,
    fontSize: 14,
    borderRadius: 11,
    background: "#10261a",
    color: "white",
    border: "1px solid #496553",
  },

  holeCard: {
    borderRadius: 21,
    background: "linear-gradient(145deg,#1c432c,#0d2116)",
    border: "1px solid #41604d",
    overflow: "hidden",
  },

  holeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 18,
  },

  holeNumber: {
    fontSize: 72,
    lineHeight: 0.95,
    fontWeight: 900,
  },

  holeFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
    textAlign: "center",
  },

  holeVisual: {
    margin: "0 16px 16px",
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(180deg,#234d31 0%,#397348 50%,#173d27 100%)",
    border: "1px solid #52755d",
    textAlign: "center",
  },

  green: {
    width: 100,
    margin: "0 auto",
    padding: 8,
    borderRadius: "50%",
    background: "#6a965d",
    color: "#07140e",
    fontSize: 11,
    fontWeight: 900,
  },

  fairway: {
    minHeight: 125,
    width: "45%",
    minWidth: 125,
    margin: "6px auto",
    padding: "12px 7px",
    borderRadius: "45% 45% 30% 30%",
    background: "rgba(118,164,94,.45)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 5,
  },

  hazard: {
    padding: "4px 7px",
    borderRadius: 12,
    background: "rgba(5,15,9,.65)",
    fontSize: 10,
  },

  tee: {
    fontSize: 10,
    fontWeight: 900,
    color: "#f5dc7c",
  },

  visualNote: {
    display: "block",
    marginTop: 8,
    color: "#b9c5bd",
  },

  overview: {
    padding: 16,
    borderTop: "1px solid #41604d",
    color: "#cad4cc",
    lineHeight: 1.5,
  },

  summary: {
    color: "#f8f4e8",
    fontWeight: 800,
  },

  scoringHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 58px 58px 48px",
    gap: 6,
    padding: "18px 9px 6px",
    color: "#83998b",
    fontSize: 9,
    fontWeight: 900,
    textAlign: "center",
  },

  scoreRow: {
    display: "grid",
    gridTemplateColumns: "minmax(120px,1fr) 58px 58px 48px",
    gap: 6,
    alignItems: "center",
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 14,
    padding: 9,
    marginBottom: 7,
  },

  scorePlayer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },

  scorePlayerText: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    gap: 2,
  },

  scoreInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 9,
    border: "1px solid #496553",
    background: "#06110b",
    color: "white",
    fontSize: 19,
    padding: "9px 2px",
    textAlign: "center",
  },

  points: {
    color: "#d9b65c",
    fontSize: 22,
    fontWeight: 900,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
  },

  holeNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
  },

  holeProgress: { fontSize: 12 },

  holePicker: {
    display: "grid",
    gridTemplateColumns: "repeat(9,1fr)",
    gap: 5,
    marginTop: 12,
  },

  holeButton: {
    minHeight: 34,
    border: "1px solid #345340",
    background: "#0d2116",
    color: "white",
    borderRadius: 8,
  },

  holeButtonActive: {
    background: "#d9b65c",
    color: "#07140e",
    fontWeight: 900,
  },

  leaderRow: {
    display: "grid",
    gridTemplateColumns: "35px 42px 1fr 55px",
    alignItems: "center",
    gap: 9,
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 15,
    padding: 12,
    marginBottom: 8,
  },

  leaderFirst: {
    border: "1px solid #d9b65c",
    background: "linear-gradient(90deg,#193824,#0e2317)",
  },

  position: {
    fontSize: 20,
    color: "#d9b65c",
    fontWeight: 900,
    textAlign: "center",
  },

  leaderName: { fontSize: 16 },

  muted: {
    color: "#9fb0a5",
    fontSize: 12,
  },

  total: {
    color: "#d9b65c",
    fontSize: 26,
    fontWeight: 900,
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
  },

  awardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
  },

  award: {
    minHeight: 125,
    padding: 12,
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 15,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  awardIcon: { fontSize: 25 },

  scorecardPlayerHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    padding: 12,
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 15,
  },

  scorecardPlayerName: { fontSize: 20 },

  scorecard: {
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 17,
    padding: 14,
    marginBottom: 13,
  },

  scorecardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },

  scorecardTotal: {
    color: "#d9b65c",
    fontSize: 30,
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    textAlign: "right",
  },

  scorecardSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    color: "#9fb0a5",
    fontSize: 12,
    paddingBottom: 10,
  },

  tableWrap: { overflowX: "auto" },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "center",
    fontSize: 12,
  },

  competitionCard: {
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
  },

  competitionEditor: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "14px 0",
    borderTop: "1px solid #294b37",
  },

  competitionIcon: { fontSize: 28 },
  competitionBody: { flex: 1 },

  competitionControls: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 8,
    marginTop: 9,
  },

  controlLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#9fb0a5",
    fontSize: 10,
  },

  smallSelect: {
    padding: 10,
    borderRadius: 9,
    border: "1px solid #496553",
    background: "#06110b",
    color: "white",
  },

  winnerSelect: {
    width: "100%",
    padding: 10,
    borderRadius: 9,
    border: "1px solid #496553",
    background: "#06110b",
    color: "white",
  },

  intro: {
    color: "#aebbb2",
    lineHeight: 1.5,
  },

  gameSetup: {
    background: "linear-gradient(145deg,#122c1d,#0b1d13)",
    border: "1px solid #41604d",
    borderRadius: 18,
    padding: 16,
    marginTop: 15,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 9,
    marginBottom: 10,
  },

  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    color: "#9fb0a5",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  },

  formControl: {
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    borderRadius: 10,
    border: "1px solid #496553",
    background: "#06110b",
    color: "white",
    fontSize: 14,
  },

  gameSubheading: {
    margin: "14px 0 8px",
    fontWeight: 900,
  },

  gamePlayerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 7,
  },

  gamePlayer: {
    background: "#091810",
    border: "1px solid #294b37",
    borderRadius: 13,
    padding: 8,
  },

  gamePlayerSelected: {
    borderColor: "#d9b65c",
  },

  playerToggle: {
    width: "100%",
    border: 0,
    padding: 0,
    background: "transparent",
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
  },

  teamButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
    marginTop: 7,
  },

  teamButton: {
    border: "1px solid #496553",
    borderRadius: 8,
    background: "#10261a",
    color: "white",
    padding: 7,
    fontWeight: 900,
  },

  teamButtonActive: {
    background: "#d9b65c",
    color: "#07140e",
    borderColor: "#d9b65c",
  },

  gameCard: {
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
  },

  gameCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },

  gameTitle: {
    margin: "5px 0",
    fontSize: 22,
  },

  gameType: {
    color: "#aebbb2",
    fontSize: 12,
  },

  deleteButton: {
    border: "1px solid #704242",
    background: "#321919",
    color: "#f1b5b5",
    padding: "7px 9px",
    borderRadius: 8,
  },

  memberChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    margin: "13px 0",
  },

  memberChip: {
    padding: "6px 9px",
    borderRadius: 20,
    background: "#173723",
    fontSize: 11,
  },

  gameResultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 7,
  },

  gameResultBox: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    gap: 7,
    padding: 9,
    background: "#091810",
    borderRadius: 12,
  },

  money: {
    gridColumn: "2 / 4",
    color: "#d9b65c",
    fontWeight: 900,
  },

  gameStatus: {
    marginTop: 12,
    padding: 9,
    borderRadius: 9,
    background: "#091810",
    color: "#b9c5bd",
    fontSize: 11,
    textAlign: "center",
  },

  gameDetails: {
    marginTop: 10,
    padding: 10,
    border: "1px solid #294b37",
    borderRadius: 10,
  },

  detailList: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginTop: 8,
    color: "#b9c5bd",
    fontSize: 11,
  },

  teamsDisplay: {
    display: "grid",
    gridTemplateColumns: "1fr 35px 1fr",
    alignItems: "center",
    gap: 7,
    marginTop: 15,
  },

  teamCard: {
    minHeight: 75,
    padding: 10,
    borderRadius: 12,
    background: "#091810",
    textAlign: "center",
    display: "grid",
    placeContent: "center",
    gap: 5,
  },

  vs: {
    color: "#d9b65c",
    fontWeight: 900,
    textAlign: "center",
  },

  matchScore: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    textAlign: "center",
  },

  emptyState: {
    padding: 20,
    borderRadius: 14,
    border: "1px dashed #496553",
    color: "#9fb0a5",
    textAlign: "center",
  },

  adminCard: {
    background: "#0e2317",
    border: "1px solid #294b37",
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
  },

  adminRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #294b37",
    padding: "9px 0",
  },

  adminPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  adminInput: {
    width: 75,
    padding: 9,
    borderRadius: 9,
    border: "1px solid #496553",
    background: "#06110b",
    color: "white",
    textAlign: "center",
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 8,
  },

  setting: {
    background: "#091810",
    padding: 11,
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  scheduleRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 70px",
    gap: 8,
    borderTop: "1px solid #294b37",
    padding: "10px 0",
    fontSize: 13,
  },

  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: "1px solid #294b37",
    textAlign: "center",
    color: "#647a6b",
    fontSize: 9,
    letterSpacing: 1.5,
  },
};
