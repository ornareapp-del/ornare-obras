import Layout from "../../components/Layout";

export default function Tarefas() {
  return (
    <Layout>

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center"
      }}>

        <h1>Tarefas</h1>

        <button
          style={{
            background:"#222",
            color:"#fff",
            border:"none",
            padding:"12px 20px",
            borderRadius:"10px",
            cursor:"pointer"
          }}
        >
          Nova Tarefa
        </button>

      </div>

      <div
        style={{
          marginTop:30,
          background:"#fff",
          padding:25,
          borderRadius:14
        }}
      >

        <h3>Módulo em construção</h3>

        <p>
          Aqui ficarão as tarefas da obra,
          responsáveis, status,
          prioridades e acompanhamento.
        </p>

      </div>

    </Layout>
  );
}