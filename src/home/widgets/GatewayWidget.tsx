import type { StatusResponse } from "../../api-types";

export function GatewayWidget({ status }: { status: StatusResponse | null }) {
  if (!status) return <span className="dim">loading…</span>;
  const platforms = Object.entries(status.gateway_platforms ?? {});
  return (
    <div className="rows">
      <div className="row">
        <span className="dim">status</span>
        <span className={status.gateway_running ? "ok" : "werr"}>
          {status.gateway_running ? "● online" : "● offline"}
        </span>
      </div>
      <div className="row">
        <span className="dim">state</span>
        <span>{status.gateway_state ?? "—"}</span>
      </div>
      {platforms.map(([name, p]) => (
        <div className="row" key={name}>
          <span className="dim">{name}</span>
          <span className={p.state === "running" ? "ok" : "dim"}>{p.state}</span>
        </div>
      ))}
    </div>
  );
}
