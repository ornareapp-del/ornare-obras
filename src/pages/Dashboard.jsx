import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardGestao from './gestao/DashboardGestao'
import Obras from './gestao/Obras'
import Agenda from './gestao/Agenda'
import Equipe from './gestao/Equipe'
import Ocorrencias from './gestao/Ocorrencias'
import Gastos from './gestao/Gastos'
import ObraDetalhe from "./gestao/ObraDetalhe";

export default function Dashboard() {
  return (
    <Routes>
      <Route path="/" element={<DashboardGestao />} />
      <Route path="/obras" element={<Obras />} />
      <Route path="/obras/:id" element={<ObraDetalhe />} />
      <Route path="/agenda" element={<Agenda />} />
      <Route path="/equipe" element={<Equipe />} />
      <Route path="/ocorrencias" element={<Ocorrencias />} />
      <Route path="/gastos" element={<Gastos />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}