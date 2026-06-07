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
        <h2>Carregando obra...</h2>
      </Layout>
    );
  }

  return (
    <Layout>

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center"
      }}>

        <div>
          <h1>{obra.nome}</h1>
          <p>{obra.cliente_nome}</p>
        </div>

        <button>
          Editar Obra
        </button>

      </div>

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
          display:"grid",
          gridTemplateColumns:"repeat(6,1fr)",
          gap:15,
          marginTop:40
        }}
      >

        <Modulo nome="Tarefas" />
        <Modulo nome="Checklist" />
        <Modulo nome="Fotos" />
        <Modulo nome="Ocorrências" />
        <Modulo nome="Gastos" />
        <Modulo nome="Histórico" />

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
        borderRadius:14,
        boxShadow:"0 4px 20px rgba(0,0,0,.05)"
      }}
    >
      <small>{titulo}</small>
      <h3>{valor}</h3>
    </div>
  );
}

function Modulo({ nome }) {
  return (
    <div
      style={{
        background:"#fff",
        padding:20,
        borderRadius:14,
        textAlign:"center",
        cursor:"pointer"
      }}
    >
      {nome}
    </div>
  );
}