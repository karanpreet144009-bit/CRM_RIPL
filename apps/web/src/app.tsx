import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './contexts/auth-context';
import { LoginPage } from './pages/login-page';
import { AppLayout } from './layouts/app-layout';
import { DashboardPage } from './pages/dashboard-page';
import { ModulePage } from './pages/module-page';
import { EmployeesPage } from './pages/employees-page';
import { PropertiesPage } from './pages/properties-page';
import { FollowUpsPage } from './pages/follow-ups-page';
import { CustomersPage } from './pages/customers-page';
import { LeadsPage } from './pages/leads-page';
import { BookingsPage } from './pages/bookings-page';
import { PaymentsPage } from './pages/payments-page';
import { ExportsPage } from './pages/exports-page';
import { ImportsPage } from './pages/imports-page';
import { ActivityHistoryPage } from './pages/activity-history-page';
import { AvailabilityBoardPage } from './pages/availability-board-page';
import { NotificationsPage } from './pages/notifications-page';
import { SettingsPage } from './pages/settings-page';
import { SiteVisitsPage } from './pages/site-visits-page';
import { AttendancePage } from './pages/attendance-page';
import { SalesDashboardPage } from './pages/sales-dashboard-page';
import { DocumentsPage } from './pages/documents-page';
import { ReportsPage } from './pages/reports-page';
import { TeamPage } from './pages/team-page';
import { SecurityPage } from './pages/security-page';
import { BrokersPage } from './pages/brokers-page';
import { LoansPage } from './pages/loans-page';
import { ExpensesPage } from './pages/expenses-page';
import { ApprovalsPage } from './pages/approvals-page';
import { AiChatbotPage } from './pages/ai-chatbot-page';
import { CalculatorPage } from './pages/calculator-page';
function Protected() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}
function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.roles.includes('ADMINISTRATOR') ? children : <Navigate to="/" replace />;
}
function EmployeeAttendanceOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return !user?.roles.includes('ADMINISTRATOR') ? children : <Navigate to="/" replace />;
}
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sales-dashboard" element={<SalesDashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/team"
          element={
            <AdminOnly>
              <TeamPage />
            </AdminOnly>
          }
        />
        <Route
          path="/attendance"
          element={
            <EmployeeAttendanceOnly>
              <AttendancePage />
            </EmployeeAttendanceOnly>
          }
        />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/availability-board" element={<AvailabilityBoardPage />} />
        <Route path="/follow-ups" element={<FollowUpsPage />} />
        <Route path="/site-visits" element={<SiteVisitsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/ai-chatbot" element={<AiChatbotPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/exports" element={<ExportsPage />} />
        <Route
          path="/imports"
          element={
            <AdminOnly>
              <ImportsPage />
            </AdminOnly>
          }
        />
        <Route
          path="/activity-history"
          element={
            <AdminOnly>
              <ActivityHistoryPage />
            </AdminOnly>
          }
        />
        <Route
          path="/security"
          element={
            <AdminOnly>
              <SecurityPage />
            </AdminOnly>
          }
        />
        <Route
          path="/brokers"
          element={
            <AdminOnly>
              <BrokersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/loans"
          element={
            <AdminOnly>
              <LoansPage />
            </AdminOnly>
          }
        />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route
          path="/settings"
          element={
            <AdminOnly>
              <SettingsPage />
            </AdminOnly>
          }
        />
        <Route
          path="/employees"
          element={
            <AdminOnly>
              <EmployeesPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
