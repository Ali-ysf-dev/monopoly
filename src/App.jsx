import { Component } from "react";
import { GameProvider, useGame } from "./context/GameContext.jsx";
import GameScreen from "./components/GameScreen.jsx";
import PlayerDashboard from "./components/PlayerDashboard.jsx";
import SetupScreen from "./components/SetupScreen.jsx";

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <h1 className="text-xl font-semibold">The banker hit a snag</h1>
        <p className="mt-3 text-ink/70">{this.state.error.message}</p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-ink px-4 py-3 font-medium text-white"
          onClick={() => {
            localStorage.removeItem("monopoly-banker-v2");
            location.reload();
          }}
        >
          Clear the saved game and reload
        </button>
      </main>
    );
  }
}

function Shell() {
  const { state, role } = useGame();
  if (role === "pending") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6">
        <p className="text-sm text-ink/60">Connecting to the table…</p>
      </main>
    );
  }
  if (role === "player" || role === "offline-player") return <PlayerDashboard />;
  return state ? <GameScreen /> : <SetupScreen />;
}

export default function App() {
  return (
    <Boundary>
      <GameProvider>
        <Shell />
      </GameProvider>
    </Boundary>
  );
}
