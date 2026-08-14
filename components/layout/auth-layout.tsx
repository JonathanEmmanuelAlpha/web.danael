import { AchievementCard, achievementCards } from "../auth/achievement-card";

/** Layout d'authentification : panneau de marque immersif + zone formulaire. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: "#0a1b43" }}
    >
      {children}
      <div className="hidden lg:flex relative flex-1 overflow-hidden">
        {/* Background Image */}
        <img
          src="/images/banner.png"
          alt="Étudiante Danaël"
          className="object-cover object-center select-none"
          sizes="(min-width: 1024px) 100vw"
        />

        {/* Overlay: left gradient (blend with form panel) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, #0a1b43 0%, rgba(10,27,67,0.45) 35%, rgba(10,27,67,0.10) 60%, transparent 100%)",
          }}
        />

        {/* Overlay: bottom gradient (text legibility) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(10,27,67,0.85) 0%, rgba(10,27,67,0.15) 40%, transparent 70%)",
          }}
        />

        {/* Floating achievement cards */}
        {achievementCards.map((card) => (
          <AchievementCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
