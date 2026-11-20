import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Offices from './pages/Offices';
import Orders from './pages/Orders';
import ImportOrders from './pages/ImportOrders';
import Drivers from './pages/Drivers';
import Customers from './pages/Customers';
import Zones from './pages/Zones';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Account from './pages/Account';

export default function App() {
  const { session } = useAuth();
  const isSuper = session?.user.role === 'super_admin';
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={session ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        {isSuper && <Route path="/offices" element={<Offices />} />}
        {!isSuper && <Route path="/orders" element={<Orders />} />}
        {!isSuper && <Route path="/import" element={<ImportOrders />} />}
        {!isSuper && <Route path="/drivers" element={<Drivers />} />}
        {!isSuper && <Route path="/customers" element={<Customers />} />}
        {!isSuper && <Route path="/zones" element={<Zones />} />}
        {!isSuper && <Route path="/finance" element={<Finance />} />}
        {!isSuper && <Route path="/reports" element={<Reports />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
