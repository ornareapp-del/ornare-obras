import { useEffect, useState } from "react";
import { getDashboardData } from "../services/dashboardService";

export default function Dashboard() {

  const [dashboard, setDashboard] = useState({
    totalObras: 0,
    obras: []
  });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const dados = await getDashboardData();
    setDashboard(dados);
  }

  return (
    <div
      style={{
        background: "#F7F4EF",
        minHeight: "100vh",
        padding: 40
      }}
    >
      <h1>ORNARE WORKS</h1>

      <p>Dashboard Executivo</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
          marginTop: 30
        }}
      >
        <Card
          titulo="Obras Ativas"
          valor={dashboard.totalObras}
        />

        <Card
          titulo="Em Montagem"
          valor={
            dashboard.obras.filter(
              o => o.status === "Em montagem"
            ).length
          }
        />

        <Card
          titulo="Pendências"
          valor="0"
        />

        <Card
          titulo="Concluídas"
          valor={
            dashboard.obras.filter(
              o => o.status === "Concluída"
            ).length
          }
        />
      </div>

      <div
        style={{
          background: "#fff",
          padding: 24,
          marginTop: 30,
          borderRadius: 16
        }}
      >
        <h2>Obras</h2>

        <table width="100%">
          <thead>
            <tr>
              <th align="left">Nome</th>
              <th align="left">Cliente</th>
              <th align="left">Status</th>
              <th align="left">Progresso</th>
            </tr>
          </thead>

          <tbody>

            {dashboard.obras.map((obra) => (
              <tr key={obra.id}>
                <td>{obra.nome}</td>
                <td>{obra.cliente_nome}</td>
                <td>{obra.status}</td>
                <td>{obra.progresso}%</td>
              </tr>
            ))}

          </tbody>

        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 24
      }}
    >
      <div>{titulo}</div>

      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          marginTop: 10
        }}
      >
        {valor}
      </div>
    </div>
  );
}