import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabase";

export default function Obras() {

  const [obras, setObras] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    cliente_nome: "",
    cidade: "",
    endereco: "",
    status: "Obra cadastrada",
    progresso: 0,
    cliente_email: "",
    cliente_telefone: "",
    comercial_nome: "",
    valor_contrato: "",
    observacoes: ""
  });

  useEffect(() => {
    carregarObras();
  }, []);

  async function carregarObras() {
    const { data } = await supabase
      .from("obras")
      .select("*")
      .order("created_at", { ascending: false });

    setObras(data || []);
  }

  async function salvarObra() {

    const { error } = await supabase
      .from("obras")
      .insert([form]);

    if (error) {
      alert(error.message);
      return;
    }

    setShowModal(false);

    setForm({
      nome: "",
      cliente_nome: "",
      cidade: "",
      endereco: "",
      status: "Obra cadastrada",
      progresso: 0,
      cliente_email: "",
      cliente_telefone: "",
      comercial_nome: "",
      valor_contrato: "",
      observacoes: ""
    });

    carregarObras();
  }

  return (
    <Layout>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>

        <h1>Obras</h1>

        <button
          onClick={() => setShowModal(true)}
          style={{
            background:"#222",
            color:"#fff",
            border:"none",
            padding:"12px 20px",
            borderRadius:"10px",
            cursor:"pointer"
          }}
        >
          Nova Obra
        </button>

      </div>

      <div style={{marginTop:30}}>

        {obras.map((obra) => (

          <div
  key={obra.id}
  onClick={() => navigate(`/obras/${obra.id}`)}
  style={{
    background:"#fff",
    padding:20,
    borderRadius:12,
    marginBottom:15,
    cursor:"pointer",
    boxShadow:"0 2px 12px rgba(0,0,0,.05)"
  }}
>
            style={{
              background:"#fff",
              padding:20,
              borderRadius:12,
              marginBottom:15,
              boxShadow:"0 2px 12px rgba(0,0,0,.05)"
            }}
          >

            <h3>{obra.nome}</h3>

            <p>Cliente: {obra.cliente_nome}</p>

            <p>Cidade: {obra.cidade}</p>

            <p>Status: {obra.status}</p>

            <p>Progresso: {obra.progresso}%</p>

          </div>

        ))}

      </div>

      {showModal && (

        <div
          style={{
            position:"fixed",
            inset:0,
            background:"rgba(0,0,0,.4)",
            display:"flex",
            justifyContent:"center",
            alignItems:"center"
          }}
        >

          <div
            style={{
              background:"#fff",
              width:600,
              padding:30,
              borderRadius:15
            }}
          >

            <h2>Nova Obra</h2>

            <input
              placeholder="Nome da obra"
              value={form.nome}
              onChange={(e)=>setForm({...form,nome:e.target.value})}
            />

            <input
              placeholder="Cliente"
              value={form.cliente_nome}
              onChange={(e)=>setForm({...form,cliente_nome:e.target.value})}
            />

            <input
              placeholder="Cidade"
              value={form.cidade}
              onChange={(e)=>setForm({...form,cidade:e.target.value})}
            />

            <input
              placeholder="Endereço"
              value={form.endereco}
              onChange={(e)=>setForm({...form,endereco:e.target.value})}
            />

            <div style={{marginTop:20}}>

              <button onClick={salvarObra}>
                Salvar
              </button>

            </div>

          </div>

        </div>

      )}

    </Layout>
  );
}