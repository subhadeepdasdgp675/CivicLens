import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Redirects authenticated users to their role-specific dashboard.
 */
const DashboardRouter = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case "department":
      return <Navigate to="/department" replace />;
    case "municipal":
      return <Navigate to="/municipal" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

export default DashboardRouter;
