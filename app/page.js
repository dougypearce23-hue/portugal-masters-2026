 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const stableford = (gross, par, strokes) =>
  gross ? Math.max(0, 2 + par + strokes - gross) : 0;

const strokesOnHole = (handicap, si) => {
  const h = Math.max(0, handicap);
  return Math.floor(h / 18) + (si <= h % 18 ? 1 : 0);
};

const playingHcp = (index, round) => {
  const slope = Number(round.slope || 113);
  const rating = Number(round.course_rating || round.par);
  const par = Number(round.par);

  const courseHcp = Math.round(
    Number(index || 0) * (slope / 113) + (rating - par)
  );

  return Math.round(courseHcp * Number(round.allowance || 0.95));
};

export default function Home() {
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [holes, setHoles] = useState([]);
  const [scores, setScores] = useState([]);

  const [roundId, setRoundId] = useState(null);
  const [holeNo, setHoleNo] = useState(1);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadApp() {
    setLoading(true);

    const [p, r, h, s] = await Promise.all([
      supabase.from("players").select("name, handicap").order("name"),
      supabase.from("pm_rounds").select("*").order("round_no"),
      supabase.from("pm_holes").select("*").order("hole_no"),
      supabase.from("pm_scores").select("*"),
    ]);

    const error = p.error || r.error || h.error || s.error;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setPlayers(p.data || []);
    setRounds(r.data || []);
    setHoles(h.data || []);
    setScores(s.data || []);

    if (r.data?.length) {
      setRoundId(r.data[0].id);
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
      h.hole_no === holeNo
  );

  function getScore(playerName, number = holeNo) {
    return scores.find(
      (s) =>
        s.round_id === round?.id &&
        s.player_name === playerName &&
        s.hole_no === number
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
    };

    const { error } = await supabase
      .from("pm_scores")
      .upsert(payload, {
        onConflict: "round_id,player_name,hole_no",
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    setScores((old) => {
      const remaining = old.filter(
        (s) =>
          !(
            s.round_id === round.id &&
            s.player_name === playerName &&
            s.hole_no === holeNo
          )
      );

      return [...remaining, payload];
    });
  }

  const leaderboard = useMemo(() => {
    return players
      .map((player) => {
        let points = 0;
        let putts = 0;
        let holesPlayed = 0;
        let birdies = 0;

        rounds.forEach((r) => {
          const ph = playingHcp(player.handicap, r);

          holes
            .filter(
              (h) => h.course_key === r.course_key
            )
            .forEach((h) => {
              const score = scores.find(
                (s) =>
                  s.round_id === r.id &&
                  s.player_name === player.name &&
                  s.hole_no === h.hole_no
              );

              if (score?.gross) {
                holesPlayed++;

                putts += Number(score.putts || 0);

                const strokes = strokesOnHole(
                  ph,
                  h.stroke_index
                );

                points += stableford(
                  Number(score.gross),
                  h.par,
                  strokes
                );

                if (
                  Number(score.gross) <=
                  Number(h.par) - 1
                ) {
                  birdies++;
                }
              }
            });
        });

        return {
          ...player,
          points,
          putts,
          holesPlayed,
          birdies,
        };
      })
      .sort((a, b) => b.points - a.points);
  }, [players, rounds, holes, scores]);

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.container}>
          <h1>Portugal Masters 2026</h1>
          <p>Loading tournament...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>

        <header style={styles.header}>
          <div>
            <div style={styles.goldSmall}>
              PENINA • ALGARVE
            </div>

            <h1 style={styles.title}>
              Portugal Masters{" "}
              <span style={styles.gold}>2026</span>
            </h1>
          </div>

          <div style={styles.badge}>
            🏆 3-Day Stableford
          </div>
        </header>

        {message && (
          <div style={styles.error}>
            {message}
          </div>
        )}

        <nav style={styles.nav}>
          <button
            onClick={() => setTab("home")}
            style={{
              ...styles.navButton,
              ...(tab === "home"
                ? styles.active
                : {}),
            }}
          >
            Trip
          </button>

          <button
            onClick={() => setTab("play")}
            style={{
              ...styles.navButton,
              ...(tab === "play"
                ? styles.active
                : {}),
            }}
          >
            Play & Score
          </button>

          <button
            onClick={() =>
              setTab("leaderboard")
            }
            style={{
              ...styles.navButton,
              ...(tab === "leaderboard"
                ? styles.active
                : {}),
            }}
          >
            Leaderboard
          </button>

          <button
            onClick={() => setTab("admin")}
            style={{
              ...styles.navButton,
              ...(tab === "admin"
                ? styles.active
                : {}),
            }}
          >
            Admin
          </button>
        </nav>

        {tab === "home" && (
          <>
            <section style={styles.hero}>
              <div style={styles.heroInner}>
                <div style={styles.goldSmall}>
                  1–3 OCTOBER 2026
                </div>

                <h2 style={styles.heroTitle}>
                  Three rounds.
                  <br />
                  Six players.
                  <br />
                  One champion.
                </h2>

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

            <h2 style={styles.section}>
              The Rounds
            </h2>

            <div style={styles.cards}>
              {rounds.map((r) => (
                <div
                  key={r.id}
                  style={styles.card}
                >
                  <div
                    style={styles.goldSmall}
                  >
                    ROUND {r.round_no}
                  </div>

                  <h3>{r.course_name}</h3>

                  <p style={styles.muted}>
                    {r.play_date}
                    <br />
                    {r.tee_time} • Yellow
                    Tees
                  </p>

                  <p>
                    Par <b>{r.par}</b>
                  </p>

                  <button
                    style={styles.secondary}
                    onClick={() => {
                      setRoundId(r.id);
                      setHoleNo(1);
                      setTab("play");
                    }}
                  >
                    Open Round
                  </button>
                </div>
              ))}
            </div>

            <h2 style={styles.section}>
              The Players
            </h2>

            <div style={styles.players}>
              {players.map((player) => (
                <div
                  key={player.name}
                  style={styles.player}
                >
                  <div style={styles.avatar}>
                    {player.name[0]}
                  </div>

                  <div>
                    <b>{player.name}</b>

                    <div style={styles.muted}>
                      Handicap{" "}
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
                    Round {r.round_no} —{" "}
                    {r.course_name}
                  </option>
                ))}
              </select>

              <section
                style={styles.holeCard}
              >
                <div
                  style={styles.holeTop}
                >
                  <div>
                    <div
                      style={
                        styles.goldSmall
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
                      styles.holeDetails
                    }
                  >
                    <span>
                      PAR{" "}
                      <b>{hole.par}</b>
                    </span>

                    <span>
                      YELLOW{" "}
                      <b>
                        {
                          hole.yellow_metres
                        }
                        m
                      </b>
                    </span>

                    <span>
                      SI{" "}
                      <b>
                        {
                          hole.stroke_index
                        }
                      </b>
                    </span>
                  </div>
                </div>

                <details
                  open
                  style={styles.overview}
                >
                  <summary>
                    Hole overview & strategy
                  </summary>

                  <p>
                    {hole.overview}
                  </p>
                </details>
              </section>

              <h2 style={styles.section}>
                Group Scoring
              </h2>

              {players.map((player) => {
                const score =
                  getScore(player.name) ||
                  {};

                const ph = playingHcp(
                  player.handicap,
                  round
                );

                const strokes =
                  strokesOnHole(
                    ph,
                    hole.stroke_index
                  );

                const points =
                  stableford(
                    Number(
                      score.gross || 0
                    ),
                    hole.par,
                    strokes
                  );

                return (
                  <div
                    key={player.name}
                    style={styles.scoreRow}
                  >
                    <div
                      style={
                        styles.scorePlayer
                      }
                    >
                      <b>
                        {player.name}
                      </b>

                      <small>
                        Playing HCP {ph}
                        <br />
                        {strokes} stroke
                        {strokes === 1
                          ? ""
                          : "s"}{" "}
                        here
                      </small>
                    </div>

                    <label
                      style={styles.label}
                    >
                      Strokes

                      <input
                        type="number"
                        inputMode="numeric"
                        value={
                          score.gross ?? ""
                        }
                        onChange={(e) =>
                          saveScore(
                            player.name,
                            "gross",
                            e.target.value
                              ? Number(
                                  e.target
                                    .value
                                )
                              : null
                          )
                        }
                        style={styles.input}
                      />
                    </label>

                    <label
                      style={styles.label}
                    >
                      Putts

                      <input
                        type="number"
                        inputMode="numeric"
                        value={
                          score.putts ?? ""
                        }
                        onChange={(e) =>
                          saveScore(
                            player.name,
                            "putts",
                            e.target.value
                              ? Number(
                                  e.target
                                    .value
                                )
                              : null
                          )
                        }
                        style={styles.input}
                      />
                    </label>

                    <div
                      style={styles.points}
                    >
                      <b>{points}</b>
                      <small>PTS</small>
                    </div>
                  </div>
                );
              })}

              <div style={styles.next}>
                <button
                  disabled={holeNo === 1}
                  style={styles.secondary}
                  onClick={() =>
                    setHoleNo((n) =>
                      Math.max(1, n - 1)
                    )
                  }
                >
                  ← Previous
                </button>

                <b>
                  {holeNo} / 18
                </b>

                <button
                  disabled={holeNo === 18}
                  style={styles.primary}
                  onClick={() =>
                    setHoleNo((n) =>
                      Math.min(18, n + 1)
                    )
                  }
                >
                  Next →
                </button>
              </div>
            </>
          )}

        {tab === "leaderboard" && (
          <>
            <div
              style={styles.goldSmall}
            >
              LIVE
            </div>

            <h2 style={styles.section}>
              Overall Leaderboard
            </h2>

            {leaderboard.map(
              (player, index) => (
                <div
                  key={player.name}
                  style={
                    styles.leaderRow
                  }
                >
                  <div
                    style={
                      styles.position
                    }
                  >
                    {index + 1}
                  </div>

                  <div
                    style={styles.avatar}
                  >
                    {player.name[0]}
                  </div>

                  <div>
                    <b>
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
                      {player.putts} putts
                      • {player.birdies}{" "}
                      birdies
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
          </>
        )}

        {tab === "admin" && (
          <>
            <h2 style={styles.section}>
              Tournament Settings
            </h2>

            <div style={styles.card}>
              <p>
                <b>Competition:</b>{" "}
                Individual Stableford
              </p>

              <p>
                <b>Allowance:</b> 95%
              </p>

              <p>
                <b>Tees:</b> Yellow
              </p>

              <p>
                <b>Rounds:</b> All 3
                count
              </p>

              <p style={styles.muted}>
                Gross scores and putts
                are stored separately,
                allowing the competition
                format to be changed
                later without losing
                score data.
              </p>
            </div>

            <h2 style={styles.section}>
              Side Competitions
            </h2>

            <div style={styles.card}>
              <p>✓ Daily Winner</p>
              <p>✓ Overall Champion</p>
              <p>✓ Most Birdies</p>
              <p>✓ Fewest Putts</p>
              <p>○ Nearest the Pin</p>
              <p>○ Longest Drive</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#07140e",
    color: "#f7f3e8",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 15px 70px",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  title: {
    fontSize: 38,
    margin: "5px 0",
  },

  gold: {
    color: "#d8b45a",
  },

  goldSmall: {
    color: "#d8b45a",
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: 800,
  },

  badge: {
    background: "#10261a",
    border: "1px solid #395444",
    padding: "9px 13px",
    borderRadius: 30,
  },

  nav: {
    display: "flex",
    gap: 7,
    overflowX: "auto",
    padding: "20px 0",
  },

  navButton: {
    border: 0,
    borderRadius: 30,
    padding: "11px 14px",
    background: "#10261a",
    color: "white",
    whiteSpace: "nowrap",
    fontWeight: 700,
  },

  active: {
    background: "#d8b45a",
    color: "#07140e",
  },

  hero: {
    borderRadius: 22,
    background:
      "linear-gradient(135deg,#244c34,#0b2116)",
    border:
      "1px solid #294b37",
    overflow: "hidden",
  },

  heroInner: {
    padding: "45px 22px",
  },

  heroTitle: {
    fontSize: 40,
    lineHeight: 1.05,
  },

  primary: {
    border: 0,
    borderRadius: 11,
    padding: "13px 16px",
    background: "#d8b45a",
    color: "#07140e",
    fontWeight: 800,
  },

  secondary: {
    border:
      "1px solid #3b5948",
    borderRadius: 11,
    padding: "12px 14px",
    background: "#10261a",
    color: "white",
    fontWeight: 700,
  },

  section: {
    marginTop: 28,
  },

  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 10,
  },

  card: {
    background: "#10261a",
    border:
      "1px solid #294b37",
    borderRadius: 17,
    padding: 17,
  },

  muted: {
    color: "#aabbb0",
    fontSize: 13,
  },

  players: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(145px,1fr))",
    gap: 8,
  },

  player: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    background: "#10261a",
    borderRadius: 13,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#244c34",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },

  select: {
    width: "100%",
    padding: 13,
    fontSize: 16,
    borderRadius: 12,
    background: "#10261a",
    color: "white",
    border:
      "1px solid #395444",
    marginBottom: 12,
  },

  holeCard: {
    borderRadius: 20,
    background:
      "linear-gradient(145deg,#173722,#0e2417)",
    border:
      "1px solid #395444",
    overflow: "hidden",
  },

  holeTop: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    padding: 18,
  },

  holeNumber: {
    fontSize: 68,
    fontWeight: 900,
  },

  holeDetails: {
    display: "flex",
    flexWrap: "wrap",
    gap: 13,
    justifyContent: "flex-end",
  },

  overview: {
    padding: 16,
    borderTop:
      "1px solid #395444",
    lineHeight: 1.5,
  },

  scoreRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(105px,1fr) 70px 62px 48px",
    gap: 7,
    alignItems: "center",
    background: "#10261a",
    border:
      "1px solid #294b37",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },

  scorePlayer: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  label: {
    fontSize: 10,
    color: "#aabbb0",
    textAlign: "center",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 4,
    borderRadius: 8,
    border:
      "1px solid #45624f",
    background: "#07140e",
    color: "white",
    fontSize: 18,
    padding: "8px 3px",
    textAlign: "center",
  },

  points: {
    color: "#d8b45a",
    fontSize: 22,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
  },

  next: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },

  leaderRow: {
    display: "grid",
    gridTemplateColumns:
      "30px 38px 1fr 55px",
    alignItems: "center",
    gap: 9,
    background: "#10261a",
    border:
      "1px solid #294b37",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },

  position: {
    fontSize: 20,
    color: "#d8b45a",
    fontWeight: 900,
  },

  total: {
    color: "#d8b45a",
    fontSize: 25,
    fontWeight: 900,
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
  },

  error: {
    background: "#4a1e1e",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
};
