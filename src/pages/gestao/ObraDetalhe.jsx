import Layout from "../../components/Layout";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ObraDetalhe() {

  const { id } = useParams();

  const [obra, setObra] = useState(null);
  const [aba, setAba] = useState("visao-geral");

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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
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
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 20,
          marginTop: 30
        }}
      >
        <Card titulo="Status" valor={obra.status} />
        <Card titulo="Progresso" valor={`${obra.progresso}%`} />
        <Card titulo="Cidade" valor={obra.cidade || "-"} />
        <Card titulo="Contrato" valor={obra.valor_contrato || "-"} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 30,
          flexWrap: "wrap"
        }}
      >
        <Aba titulo="Visão Geral" valor="visao-geral" aba={aba} setAba={setAba} />
        <Aba titulo="Tarefas" valor="tarefas" aba={aba} setAba={setAba} />
        <Aba titulo="Checklist" valor="checklist" aba={aba} setAba={setAba} />
        <Aba titulo="Fotos" valor="fotos" aba={aba} setAba={setAba} />
        <Aba titulo="Ocorrências" valor="ocorrencias" aba={aba} setAba={setAba} />
        <Aba titulo="Gastos" valor="gastos" aba={aba} setAba={setAba} />
        <Aba titulo="Cliente" valor="cliente" aba={aba} setAba={setAba} />
        <Aba titulo="Histórico" valor="historico" aba={aba} setAba={setAba} />
      </div>

      <div
        style={{
          marginTop: 25,
          background: "#fff",
          padding: 25,
          borderRadius: 14
        }}
      >

        {aba === "visao-geral" && (
          <>
            <h2>Resumo da Obra</h2>

            <p><strong>Cliente:</strong> {obra.cliente_nome}</p>
            <p><strong>Email:</strong> {obra.cliente_email}</p>
            <p><strong>Telefone:</strong> {obra.cliente_telefone}</p>
            <p><strong>Endereço:</strong> {obra.endereco}</p>
            <p><strong>Observações:</strong> {obra.observacoes}</p>
          </>
        )}

        {aba === "tarefas" && (
          <>
            <h2>Tarefas</h2>
            <p>Próximo passo: conectar tabela tarefas.</p>
          </>
        )}

        {aba === "checklist" && (
          <>
            <h2>Checklist</h2>
            <p>Checklist operacional da obra.</p>
          </>
        )}

        {aba === "fotos" && (
          <>
            <h2>Fotos</h2>
            <p>Galeria de fotos da obra.</p>
          </>
        )}

        {aba === "ocorrencias" && (
          <>
            <h2>Ocorrências</h2>
            <p>Registro de problemas e pendências.</p>
          </>
        )}

        {aba === "gastos" && (
          <>
            <h2>Gastos</h2>
            <p>Controle financeiro do supervisor.</p>
          </>
        )}

        {aba === "cliente" && (
          <>
            <h2>Portal Cliente</h2>
            <p>Informações visíveis ao cliente.</p>
          </>
        )}

        {aba === "historico" && (
          <>
            <h2>Histórico</h2>
            <p>Histórico completo da obra.</p>
          </>
        )}

      </div>

    </Layout>
  );
}

function Card({ titulo, valor }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 14
      }}
    >
      <small>{titulo}</small>
      <h3>{valor}</h3>
    </div>
  );
}

function Aba({ titulo, valor, aba, setAba }) {
  return (
    <button
      onClick={() => setAba(valor)}
      style={{
        background: aba === valor ? "#222" : "#fff",
        color: aba === valor ? "#fff" : "#222",
        border: "none",
        borderRadius: 10,
        padding: "10px 18px",
        cursor: "pointer"
      }}
    >
      {titulo}
    </button>
  );
}