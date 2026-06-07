import Layout from "../../components/Layout";
import { useParams } from "react-router-dom";

export default function ObraDetalhe() {

  const { id } = useParams();

  return (
    <Layout>

      <h1>Detalhes da Obra</h1>

      <p>ID: {id}</p>

      <div style={{display:"flex",gap:20,marginTop:30}}>

        <button>Visão Geral</button>
        <button>Tarefas</button>
        <button>Checklist</button>
        <button>Fotos</button>
        <button>Ocorrências</button>
        <button>Gastos</button>
        <button>Cliente</button>

      </div>

    </Layout>
  );
}