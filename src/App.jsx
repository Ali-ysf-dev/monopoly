import { Component } from "react";
import { GameProvider, useGame } from "./context/GameContext.jsx";
import GameScreen from "./components/GameScreen.jsx";
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
        <p className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">Monopoly Banker</p>
        <h1 className="mt-2 font-display text-4xl">The banker hit a snag</h1>
        <p className="mt-3 text-ivory/75">{this.state.error.message}</p>
        <button
          type="button"
          className="mt-6 rounded-2xl bg-gold px-4 py-3 font-semibold text-ink"
          onClick={() => {
            localStorage.removeItem("monopoly-banker-v1");
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
  const { state } = useGame();
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
