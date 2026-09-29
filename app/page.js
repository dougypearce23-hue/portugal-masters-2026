"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("name, handicap")
      .order("name");

    if (error) {
      console.error(error);
    } else {
      setPlayers(data || []);
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07140e",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          minHeight: "55vh",
          backgroundImage:
            "linear-gradient(to bottom, rgba(0,0,0,.05), #07140e), url('/portugal-masters-opening.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "30px 20px",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "42px", margin: 0 }}>
            Portugal Masters
          </h1>
          <p style={{ fontSize: "22px", marginTop: "8px" }}>
            2026
          </p>
        </div>
      </section>

      <section
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "25px 20px 60px",
        }}
      >
        <h2>The Players</h2>

        {loading && <p>Loading players...</p>}

        {!loading &&
          players.map((player) => (
            <div
              key={player.name}
              style={{
                background: "#10261a",
                border: "1px solid #294b37",
                borderRadius: "14px",
                padding: "18px",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: "20px" }}>
                {player.name}
              </strong>

              <span>
                Handicap {Number(player.handicap).toFixed(0)}
              </span>
            </div>
          ))}
      </section>
    </main>
  );
}
