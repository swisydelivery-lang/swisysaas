import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import OrderModal from './OrderModal';

export default function Layout() {
  const { session, logout } = useAuth();
  const nav = useNavigate();
  const [showNew, setShowNew] = useState(false);
  if (!session) return null;
  const { user, office } = session;
  const isSuper = user.role === 'super_admin';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">S</div>
          <div>Swisy Delivery</div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>لوحة التحكم</NavLink>
          {isSuper && <NavLink to="/offices">المكاتب</NavLink>}
          {!isSuper && <NavLink to="/orders">الطلبات</NavLink>}{!isSuper && <NavLink to="/import">استيراد الطلبات</NavLink>}
          {!isSuper && <NavLink to="/drivers">المناديب</NavLink>}
          {!isSuper && <NavLink to="/customers">العملاء</NavLink>}{!isSuper && <NavLink to="/zones">المناطق</NavLink>}
          {!isSuper && <NavLink to="/finance">الحسابات والعمولات</NavLink>}
          {!isSuper && <NavLink to="/reports">التقارير</NavLink>}
          <NavLink to="/account">حسابي</NavLink>
        </nav>
        <div className="spacer" />
        <button className="btn" onClick={logout}>تسجيل الخروج</button>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>{isSuper ? 'لوحة السوبر أدمن' : (office?.name ?? 'لوحة الأدمن')}</h1>
          <div className="row">
            {!isSuper && (
              <button className="btn primary big" onClick={() => setShowNew(true)}>
                ＋ إنشاء طلب
              </button>
            )}
            {office && (
              <span className={office.warning ? 'chip red' : 'chip green'}>
                {office.warning
                  ? 'الاشتراك: باقي ' + office.daysLeft + ' أيام – جدد لتفادي توقف الحساب'
                  : 'الاشتراك: باقي ' + office.daysLeft + ' يوم'}
              </span>
            )}
          </div>
        </div>
        <Outlet />
      </main>
      {showNew && (
        <OrderModal
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            nav('/orders');
            window.dispatchEvent(new Event('orders-changed'));
          }}
        />
      )}
    </div>
  );
}


