import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  Sequence,
  useCurrentFrame,
} from "remotion";

// ─── Real data from demo-sim (pure circuits are real; finality simulated) ───
const DATA = {
  amount: "1000",
  wallet:
    "mn_addr_preprod1c2ljvsln2z5aca6nmd44skj72kmdavnm03vm9v3rwm37kclfnptsffuh6t",
  faucetTx:
    "00bc9da4d80c86b1b7805df25384ef87228111e56734f94d64bf9f7ef148a141ab",
  shieldCommitment:
    "e1f90759801b62f218df7b5c3897e5893c46e092da41a1ae521794c4b4bb80f2",
  transferCommitment:
    "9a3ece02a28c3e63b02cdb3c5471f7f0ba80cbcca434c0cbceff1a0a36325ac5",
  nullifier:
    "7fe393398393a6cf919b46dfe502f4099c464362d92d60e43fb361f4c78b73fa",
  auditRequestId:
    "a8f11bd9eda674e1876d9b7ecfee21d2af0bed8e8cadd87242ed62c5e817df50",
};
const short = (h: string, n = 12) => `${h.slice(0, n)}…${h.slice(-6)}`;

// ─── Theme ───
const NIGHT_BG = "linear-gradient(180deg, #050816 0%, #0a1030 55%, #101a4a 100%)";
const INK = "#e8ecff";
const DIM = "rgba(232,236,255,0.55)";
const GOLD = "#f5c96b";
const GREEN = "#5dd39e";
const RED = "#ff7a7a";
const CYAN = "#7ad7ff";
const MONO =
  "ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace";
const SANS =
  "'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, sans-serif";

const useFade = (inFrames = 15, outStart?: number, total?: number) => {
  const frame = useCurrentFrame();
  let o = interpolate(frame, [0, inFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  if (outStart !== undefined && total !== undefined) {
    o *= interpolate(frame, [outStart, total], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return o;
};

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: random(`x${i}`) * 1280,
    y: random(`y${i}`) * 640,
    r: 0.6 + random(`r${i}`) * 1.6,
    tw: random(`t${i}`) * 60,
  }));
  return (
    <AbsoluteFill>
      <svg width={1280} height={720}>
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#cdd8ff"
            opacity={
              0.25 +
              0.55 *
                Math.abs(Math.sin((frame + s.tw) / (28 + (s.tw % 13))))
            }
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const Slide: React.FC<{
  children: React.ReactNode;
  total: number;
  fadeOutAt?: number;
}> = ({ children, total, fadeOutAt }) => {
  const opacity = useFade(14, fadeOutAt ?? total - 12, total);
  return (
    <AbsoluteFill
      style={{
        background: NIGHT_BG,
        color: INK,
        fontFamily: SANS,
        opacity,
      }}
    >
      <Stars />
      {children}
    </AbsoluteFill>
  );
};

// ─── Terminal ───
type TLine = { text: string; color?: string; delay: number };
const Terminal: React.FC<{ title: string; lines: TLine[] }> = ({
  title,
  lines,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        top: 120,
        bottom: 90,
        background: "rgba(3,6,18,0.92)",
        border: "1px solid rgba(122,215,255,0.25)",
        borderRadius: 14,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          background: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div
            key={c}
            style={{ width: 12, height: 12, borderRadius: 6, background: c }}
          />
        ))}
        <span
          style={{ marginLeft: 12, fontFamily: MONO, fontSize: 15, color: DIM }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: "20px 26px", fontFamily: MONO, fontSize: 19, lineHeight: 1.75 }}>
        {lines.map((l, i) => {
          const reveal = interpolate(
            frame,
            [l.delay, l.delay + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <div
              key={i}
              style={{
                opacity: reveal,
                transform: `translateY(${(1 - reveal) * 8}px)`,
                color: l.color ?? INK,
                whiteSpace: "pre",
              }}
            >
              {l.text}
            </div>
          );
        })}
        <span
          style={{
            display: "inline-block",
            width: 11,
            height: 22,
            background: frame % 30 < 15 ? CYAN : "transparent",
            verticalAlign: "middle",
          }}
        />
      </div>
    </div>
  );
};

const SceneHeader: React.FC<{ kicker: string; title: string }> = ({
  kicker,
  title,
}) => (
  <div style={{ position: "absolute", top: 44, left: 90, right: 90 }}>
    <div
      style={{
        fontSize: 16,
        letterSpacing: 4,
        color: GOLD,
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {kicker}
    </div>
    <div style={{ fontSize: 34, fontWeight: 700, marginTop: 4 }}>{title}</div>
  </div>
);

// ─── Scene 1: Cold open (0–8s) ───
const ColdOpen: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 40], [0.94, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <Slide total={total}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          transform: `scale(${scale})`,
        }}
      >
        <div style={{ fontSize: 22, color: GOLD, letterSpacing: 6, fontWeight: 600 }}>
          MLH MIDNIGHT HACKATHON · JULY 2026
        </div>
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: 10,
            marginTop: 14,
            textShadow: "0 0 60px rgba(122,215,255,0.35)",
          }}
        >
          SERENO
        </div>
        <div style={{ fontSize: 28, color: INK, marginTop: 10, maxWidth: 900 }}>
          A shielded remittance corridor{" "}
          <span style={{ color: CYAN }}>regulators can live with</span>
        </div>
        <div style={{ fontSize: 19, color: DIM, marginTop: 26, fontStyle: "italic" }}>
          Buenos Aires' night watchman once called out at midnight:
          <br />
          <span style={{ color: GOLD }}>
            “¡Las doce han dado… y sereno!” — “midnight struck, and all is well.”
          </span>
        </div>
      </AbsoluteFill>
    </Slide>
  );
};

// ─── Scene 2: Problem (8–20s) ───
const Problem: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const Card: React.FC<{
    title: string;
    body: string;
    color: string;
    delay: number;
  }> = ({ title, body, color, delay }) => {
    const o = interpolate(frame, [delay, delay + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <div
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${color}55`,
          borderTop: `4px solid ${color}`,
          borderRadius: 14,
          padding: "30px 34px",
          opacity: o,
          transform: `translateY(${(1 - o) * 20}px)`,
        }}
      >
        <div style={{ fontSize: 27, fontWeight: 700, color }}>{title}</div>
        <div style={{ fontSize: 21, color: INK, marginTop: 12, lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    );
  };
  const punch = interpolate(frame, [200, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Slide total={total}>
      <SceneHeader kicker="The problem" title="LatAm remittances force a bad choice" />
      <div
        style={{
          position: "absolute",
          top: 190,
          left: 90,
          right: 90,
          display: "flex",
          gap: 30,
        }}
      >
        <Card
          title="Formal rails"
          body="Every payment public forever. Families publish their finances to send money home."
          color={RED}
          delay={30}
        />
        <Card
          title="Informal rails"
          body="Zero compliance, zero recourse. Regulators are handed a black box."
          color={RED}
          delay={70}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 34,
          fontWeight: 700,
          opacity: punch,
          color: GOLD,
        }}
      >
        Sereno: private in the middle, accountable at the edges.
      </div>
    </Slide>
  );
};

// ─── Scene 3: shield + transfer (20–48s) ───
const DemoCorridor: React.FC<{ total: number }> = ({ total }) => (
  <Slide total={total}>
    <SceneHeader
      kicker="Demo · Midnight Compact circuits"
      title="Shield on entry, private transfer inside"
    />
    <Terminal
      title="sereno-cli — preprod corridor (real pure circuits)"
      lines={[
        { text: "$ sereno shield 1000", color: CYAN, delay: 20 },
        { text: "✓ amount 1000 disclosed on entry — TVL = 1000 (public edge)", color: GREEN, delay: 45 },
        { text: `✓ note commitment  ${short(DATA.shieldCommitment)}`, color: GREEN, delay: 70 },
        { text: "✓ inserted into HistoricMerkleTree · leaf 0", color: GREEN, delay: 95 },
        { text: "  note interior stays private (hiding commitment)", color: DIM, delay: 120 },
        { text: " ", delay: 150 },
        { text: "$ sereno transfer <recipient>", color: CYAN, delay: 165 },
        { text: "✓ membership proved via Merkle path (in-circuit)", color: GREEN, delay: 195 },
        { text: `✓ nullifier published  ${short(DATA.nullifier)}  — double-spend dead`, color: GREEN, delay: 225 },
        { text: `✓ new commitment       ${short(DATA.transferCommitment)}`, color: GREEN, delay: 255 },
        { text: "✓ ElGamal ciphertext → auditor pk (in-circuit) — amount hidden from public", color: GOLD, delay: 290 },
        { text: " ", delay: 330 },
        { text: "PUBLIC LEDGER: commitments · nullifiers · TVL — NO transfer amounts, NO parties", color: CYAN, delay: 345 },
      ]}
    />
  </Slide>
);

// ─── Scene 4: selective disclosure (48–68s) ───
const Disclosure: React.FC<{ total: number }> = ({ total }) => (
  <Slide total={total}>
    <SceneHeader
      kicker="Demo · the Sereno moment"
      title="Selective disclosure — a proof, not a backdoor"
    />
    <Terminal
      title="sereno-cli — discloseToAuditor"
      lines={[
        { text: `$ sereno disclose --request ${short(DATA.auditRequestId, 10)}`, color: CYAN, delay: 20 },
        { text: "✓ owner proves IN-CIRCUIT: commitment opens to amount = 1000", color: GREEN, delay: 55 },
        { text: "✓ recorded on-ledger under THIS audit request only", color: GREEN, delay: 90 },
        { text: "✓ note NOT spent — still fully usable", color: GREEN, delay: 125 },
        { text: " ", delay: 160 },
        { text: "Only what was asked. Only to the auditor. Only under this request.", color: GOLD, delay: 175 },
        { text: " ", delay: 215 },
        { text: "$ sereno unshield", color: CYAN, delay: 230 },
        { text: "✓ amount 1000 public on exit — TVL = 0 · accountable edge complete", color: GREEN, delay: 260 },
        { text: " ", delay: 300 },
        { text: "Zerocash notes + Privacy Pools accountability, native on Midnight.", color: CYAN, delay: 315 },
      ]}
    />
  </Slide>
);

// ─── Scene 5: why Midnight + honesty (68–80s) ───
const WhyMidnight: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const items = [
    "Compact: commitments, Merkle trees & private witnesses are first-class",
    "4 circuits compiled: shield · transfer · unshield · discloseToAuditor",
    "In-circuit exponential ElGamal to a sealed auditor key",
    "Client-side proving against a local proof server",
  ];
  return (
    <Slide total={total}>
      <SceneHeader kicker="Why Midnight" title="The chain does the heavy lifting" />
      <div style={{ position: "absolute", top: 190, left: 120, right: 120 }}>
        {items.map((t, i) => {
          const o = interpolate(frame, [25 + i * 30, 40 + i * 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontSize: 25,
                margin: "16px 0",
                opacity: o,
                transform: `translateX(${(1 - o) * 24}px)`,
              }}
            >
              <span style={{ color: GREEN, marginRight: 14 }}>✓</span>
              {t}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 30,
            fontSize: 17,
            color: DIM,
            fontFamily: MONO,
            opacity: interpolate(frame, [160, 180], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          honest scope: circuits & wallet funding are real (faucet tx{" "}
          {short(DATA.faucetTx, 8)}) · tx finality shown here is simulated —
          public preprod RPC sync is the one open issue
        </div>
      </div>
    </Slide>
  );
};

// ─── Scene 6: close (80–90s) ───
const Close: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const o2 = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Slide total={total} fadeOutAt={total - 20}>
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 6 }}>SERENO</div>
        <div style={{ fontSize: 24, color: INK, marginTop: 14 }}>
          Send money home. Keep your privacy. Keep the regulator satisfied.
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, color: CYAN, marginTop: 34 }}>
          github.com/leocagli/sereno
        </div>
        <div style={{ fontFamily: MONO, fontSize: 19, color: DIM, marginTop: 8 }}>
          sereno-kappa-eight.vercel.app
        </div>
        <div
          style={{
            fontSize: 26,
            color: GOLD,
            marginTop: 40,
            fontStyle: "italic",
            opacity: o2,
          }}
        >
          “¡Las doce han dado… y sereno!” ✓
        </div>
      </AbsoluteFill>
    </Slide>
  );
};

// ─── Main ───
export const SerenoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#050816" }}>
      <Sequence durationInFrames={240}>
        <ColdOpen total={240} />
      </Sequence>
      <Sequence from={240} durationInFrames={360}>
        <Problem total={360} />
      </Sequence>
      <Sequence from={600} durationInFrames={840}>
        <DemoCorridor total={840} />
      </Sequence>
      <Sequence from={1440} durationInFrames={600}>
        <Disclosure total={600} />
      </Sequence>
      <Sequence from={2040} durationInFrames={360}>
        <WhyMidnight total={360} />
      </Sequence>
      <Sequence from={2400} durationInFrames={300}>
        <Close total={300} />
      </Sequence>
    </AbsoluteFill>
  );
};
