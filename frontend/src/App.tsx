import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { GuestReportProvider } from "@/contexts/GuestReportContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouter from "@/components/DashboardRouter";
import GuestReportPage from "@/pages/GuestReportPage";

// Public pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

// Layouts
import CitizenLayout from "@/layouts/CitizenLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import MunicipalLayout from "@/layouts/MunicipalLayout";

// Citizen pages
import CitizenDashboard from "@/pages/citizen/CitizenDashboard";
import ReportIssue from "@/pages/citizen/ReportIssue";
import IssueDetail from "@/pages/citizen/IssueDetail";
import SearchPage from "@/pages/citizen/SearchPage";
import ProfilePage from "@/pages/citizen/ProfilePage";

// Department pages
import DeptDashboard from "@/pages/department/DeptDashboard";
import TicketDetail from "@/pages/department/TicketDetail";
import DeptPerformance from "@/pages/department/DeptPerformance";

import { MunicipalCityProvider } from "@/contexts/MunicipalCityContext";

// Municipal pages
import MunicipalOverview from "@/pages/municipal/MunicipalOverview";
import MunicipalDepartments from "@/pages/municipal/MunicipalDepartments";
import MunicipalEscalations from "@/pages/municipal/MunicipalEscalations";
import MunicipalReports from "@/pages/municipal/MunicipalReports";
import MunicipalReviewQueue from "@/pages/municipal/MunicipalReviewQueue";
import MunicipalIntelligenceWorkspace from "@/pages/municipal/MunicipalIntelligenceWorkspace";

// Shared pages
import NotificationsPage from "@/pages/NotificationsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GuestReportProvider>
      <SocketProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Guest report flow — no auth required */}
            <Route path="/report-issue-guest" element={<GuestReportPage />} />

            {/* Dashboard router — redirects by role */}
            <Route
              path="/dashboard-redirect"
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              }
            />

            {/* Citizen routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["citizen"]}>
                  <CitizenLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CitizenDashboard />} />
              <Route path="report" element={<ReportIssue />} />
              <Route path="issue/:id" element={<IssueDetail />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Department routes */}
            <Route
              path="/department"
              element={
                <ProtectedRoute allowedRoles={["department"]}>
                  <DepartmentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DeptDashboard />} />
              <Route path="ticket/:id" element={<TicketDetail />} />
              <Route path="performance" element={<DeptPerformance />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Municipal Corporation routes */}
            <Route
              path="/municipal"
              element={
                <ProtectedRoute allowedRoles={["municipal"]}>
                  <MunicipalCityProvider>
                    <MunicipalLayout />
                  </MunicipalCityProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<MunicipalOverview />} />
              <Route path="departments" element={<MunicipalDepartments />} />
              <Route path="escalations" element={<MunicipalEscalations />} />
              <Route path="reports" element={<MunicipalReports />} />
              <Route path="civiclens" element={<MunicipalReviewQueue />} />
              <Route path="ai-review-queue" element={<MunicipalReviewQueue />} />
              <Route path="intelligence" element={<MunicipalIntelligenceWorkspace />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </SocketProvider>
      </GuestReportProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
