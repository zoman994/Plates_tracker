import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("CloneTracker error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 16, fontFamily: "monospace", padding: 32,
          background: "#09090b", color: "#d4d4d8",
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#ef4444" }}>Произошла ошибка</div>
          <div style={{ fontSize: 12, color: "#71717a", maxWidth: 500, textAlign: "center" }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>
              Попробовать снова
            </button>
            <button onClick={() => window.location.reload()}
              style={{ padding: "8px 16px", background: "#3f3f46", color: "#d4d4d8", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>
              Перезагрузить
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#52525b", marginTop: 8 }}>
            Данные сохранены автоматически. Ctrl+S = бэкап.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
