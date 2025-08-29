import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { InterviewProvider } from "@/lib/store.tsx";
import AppShell from "@/components/AppShell";
import Apply from "./pages/Apply";
import Interview from "./pages/Interview";
import Results from "./pages/Results";
import ThankYou from "./pages/ThankYou";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <InterviewProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<Apply />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/interview" element={<Interview />} />
              <Route path="/results" element={<Results />} />
              <Route path="/thank-you" element={<ThankYou />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </InterviewProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
