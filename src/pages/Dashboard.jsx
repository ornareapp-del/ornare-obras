import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import DashboardGestao from "./gestao/DashboardGestao";
import Obras from "./gestao/Obras";
import ObraDetalhe from "./gestao/ObraDetalhe";
import Agenda from "./gestao/Agenda";
import Equipe from "./gestao/Equipe";
import Ocorrencias from "./gestao/Ocorrencias";
import Gastos from "./gestao/Gastos";
import Tarefas from "./gestao/Tarefas";

export default function Dashboard() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardGestao />} />
        <Route path="/obras" element={<Obras />} />
        <Route path="/obras/:id" element={<ObraDetalhe />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/tarefas" element={<Tarefas />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}