export default function Dashboard() {
  return (
    <div style={{
      background:"#F7F4EF",
      minHeight:"100vh",
      padding:"32px",
      fontFamily:"Inter, sans-serif"
    }}>

      <h1 style={{
        margin:0,
        color:"#2B2B2B"
      }}>
        Ornare Gestão de Obras
      </h1>

      <p style={{
        color:"#777",
        marginTop:8
      }}>
        Dashboard Executivo
      </p>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(4,1fr)",
        gap:"16px",
        marginTop:"32px"
      }}>

        <Card titulo="Obras Ativas" valor="27" />
        <Card titulo="Em Montagem" valor="8" />
        <Card titulo="Pendências" valor="5" />
        <Card titulo="Concluídas" valor="14" />

      </div>

      <div style={{
        background:"#fff",
        padding:"24px",
        borderRadius:"16px",
        marginTop:"32px"
      }}>

        <h2>Obras em Andamento</h2>

        <table width="100%">
          <thead>
            <tr>
              <th align="left">Obra</th>
              <th align="left">Supervisor</th>
              <th align="left">Status</th>
              <th align="left">Progresso</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>Residência Gustavo</td>
              <td>João</td>
              <td>Montagem</td>
              <td>78%</td>
            </tr>

            <tr>
              <td>Marco Puerta</td>
              <td>Pedro</td>
              <td>Ajustes</td>
              <td>92%</td>
            </tr>

          </tbody>

        </table>

      </div>

    </div>
  )
}

function Card({ titulo, valor }) {
  return (
    <div style={{
      background:"#fff",
      borderRadius:"16px",
      padding:"24px",
      boxShadow:"0 2px 10px rgba(0,0,0,0.05)"
    }}>
      <div style={{
        color:"#777",
        fontSize:"14px"
      }}>
        {titulo}
      </div>

      <div style={{
        fontSize:"32px",
        marginTop:"8px",
        fontWeight:"600"
      }}>
        {valor}
      </div>
    </div>
  )
}