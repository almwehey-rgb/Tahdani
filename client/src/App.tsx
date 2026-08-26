import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Packages from './pages/Packages';
import Gifts from './pages/Gifts';
import Account from './pages/Account';
import History from './pages/History';
import Episodes from './pages/Episodes';
import TvApply from './pages/TvApply';
import PaymentCallback from './pages/PaymentCallback';

import NewGameWizard from './pages/game/NewGameWizard';
import Board from './pages/game/Board';
import ResultScreen from './pages/game/ResultScreen';

import SubjectPicker from './pages/student/SubjectPicker';
import StudentQuiz from './pages/student/StudentQuiz';

import TournamentsList from './pages/tournaments/TournamentsList';
import CreateTournament from './pages/tournaments/CreateTournament';
import TournamentDetail from './pages/tournaments/TournamentDetail';

import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminGames from './pages/admin/AdminGames';
import AdminCategories from './pages/admin/AdminCategories';
import AdminPackages from './pages/admin/AdminPackages';
import AdminDiscounts from './pages/admin/AdminDiscounts';
import AdminPurchases from './pages/admin/AdminPurchases';
import AdminVarReports from './pages/admin/AdminVarReports';
import AdminTvApplications from './pages/admin/AdminTvApplications';
import AdminEpisodes from './pages/admin/AdminEpisodes';
import AdminStudentContent from './pages/admin/AdminStudentContent';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="episodes" element={<Episodes />} />
        <Route path="tv-apply" element={<TvApply />} />
        <Route path="packages" element={<Packages />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="account" element={<Account />} />
          <Route path="history" element={<History />} />
          <Route path="gifts" element={<Gifts />} />
          <Route path="payment/callback" element={<PaymentCallback />} />

          <Route path="new-game" element={<NewGameWizard mode="CLASSIC" />} />
          <Route path="new-game/kids" element={<NewGameWizard mode="KIDS" />} />
          <Route path="new-game/danger" element={<NewGameWizard mode="DANGER" />} />
          <Route path="new-game/student" element={<SubjectPicker />} />
          <Route path="student/:subjectId" element={<StudentQuiz />} />

          <Route path="game/:id/board" element={<Board />} />
          <Route path="game/:id/result" element={<ResultScreen />} />

          <Route path="tournaments" element={<TournamentsList />} />
          <Route path="tournaments/new" element={<CreateTournament />} />
          <Route path="tournaments/:id" element={<TournamentDetail />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="games" element={<AdminGames />} />
            <Route path="packages" element={<AdminPackages />} />
            <Route path="discounts" element={<AdminDiscounts />} />
            <Route path="purchases" element={<AdminPurchases />} />
            <Route path="var-reports" element={<AdminVarReports />} />
            <Route path="tv-applications" element={<AdminTvApplications />} />
            <Route path="episodes" element={<AdminEpisodes />} />
            <Route path="student-content" element={<AdminStudentContent />} />
          </Route>
        </Route>

        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
