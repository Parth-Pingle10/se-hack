import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Upload from "./pages/Upload.tsx";
import DashboardLayout from "./components/DashboardLayout.tsx";
import Benford from "./pages/dashboard/Benford.tsx";
import Fuzzy from "./pages/dashboard/Fuzzy.tsx";
import Anomalies from "./pages/dashboard/Anomalies.tsx";
import Reconciliation from "./pages/dashboard/Reconciliation.tsx";
import RiskNetwork from "./pages/dashboard/RiskNetwork.tsx";
import MonteCarlo from "./pages/dashboard/MonteCarlo.tsx";
import Summary from "./pages/dashboard/Summary.tsx";
import Settings from "./pages/dashboard/Settings.tsx";
import IndustryBenchmark from "./pages/dashboard/IndustryBenchmark.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard/benford" replace />} />
            <Route path="benford"   element={<Benford />} />
            <Route path="fuzzy"     element={<Fuzzy />} />
            <Route path="anomalies"      element={<Anomalies />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="network"        element={<RiskNetwork />} />
            <Route path="monte-carlo"    element={<MonteCarlo />} />
            <Route path="benchmark"      element={<IndustryBenchmark />} />
            <Route path="summary"        element={<Summary />} />
            <Route path="settings"       element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
