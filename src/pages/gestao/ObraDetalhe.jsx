import Layout from "../../components/Layout";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ObraDetalhe() {

  const { id } = useParams();

  const [obra, setObra] = useState(null);

  useEffect(() => {
    carregarObra();
  }, []);

  async function carregarObra() {

    const { data } = await supabase
      .from("obras")
      .select("*")
      .eq("id", id)
      .single();

    setObra(data);
  }

  if (!obra) {
    return (
      <Layout>
        <h2>Carregando...</h2>
      </Layout>
    );
  }

  return (
    <Layout>

      <h1>{obra.nome}</h1>

      <p>{obra.cliente_nome}</p>

      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(4,1fr)",
          gap:20,
          marginTop:30
        }}
      >

        <Card titulo="Status" valor={obra.status} />
        <Card titulo="Progresso" valor={`${obra.progresso}%`} />
        <Card titulo="Cidade" valor={obra.cidade || "-"} />
        <Card titulo="Contrato" valor={obra.valor_contrato || "-"} />

      </div>

      <div
        style={{
          marginTop:40,
          display:"flex",
          gap:10,
          flexWrap:"wrap"
        }}
      >
        <button>Tarefas</button>
        <button>Checklist</button>
        <button>Fotos</button>
        <button>Ocorrências</button>
        <button>Gastos</button>
        <button>Cliente</button>
        <button>Histórico</button>
      </div>

    </Layout>
  );
}

function Card({ titulo, valor }) {
  return (
    <div
      style={{
        background:"#fff",
        padding:20,
        borderRadius:14
      }}
    >
      <small>{titulo}</small>
      <h3>{valor}</h3>
    </div>
  );
}