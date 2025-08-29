import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';

const Results = () => {
  const data = useMemo(() => {
    try {
      const raw = localStorage.getItem('ai-interviewer/results');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass-card p-6 text-center max-w-xl w-full">
          <h1 className="text-2xl font-bold mb-2">No Results Found</h1>
          <p className="text-muted-foreground mb-4">Complete an interview to view detailed results.</p>
          <Button onClick={() => (window.location.href = '/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const { user, transcript, duration, generatedAt } = data as {
    user: { firstName: string; lastName: string; email: string; phone: string };
    transcript: Array<{ id: string; type: 'ai' | 'user'; content: string; timestamp: string | number | Date }>;
    duration: number;
    generatedAt: string;
    summary?: { score?: number; role?: string };
    aiSummary?: string;
    summaryText?: string;
  };
  const aiSummary: string | undefined = (data as any)?.summary?.finalFeedback || (data as any)?.aiSummary || (data as any)?.summaryText;
  const backendTranscript: Array<{questionNumber:number;question:string;userResponse:string;timestamp?:string}> | undefined = (data as any)?.summary?.transcript;

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const title = `Interview Report - ${user?.firstName || 'Candidate'} ${user?.lastName || ''}`;
    doc.setFontSize(16);
    doc.text(title, 10, 15);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date(generatedAt).toLocaleString()}`, 10, 25);
    if (data?.summary?.score !== undefined) {
      doc.text(`Score: ${data.summary.score}`, 10, 33);
    }
    if (data?.summary?.role) {
      doc.text(`Role: ${data.summary.role}`, 10, 41);
    }
    doc.text(`Duration: ${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`, 10, 49);
    let y = 62;
    if (aiSummary) {
      doc.setFontSize(12);
      doc.text('AI Summary:', 10, y);
      y += 8;
      doc.setFontSize(10);
      const splitSum = doc.splitTextToSize(aiSummary, 180);
      splitSum.forEach((ln: string) => {
        if (y > 280) { doc.addPage(); y = 15; }
        doc.text(ln, 10, y); y += 6;
      });
      y += 6;
    }

    doc.setFontSize(12);
    doc.text('Transcript:', 10, y);
    y += 8;
    doc.setFontSize(10);
    const renderLines = (lines: string[]) => {
      lines.forEach((line) => {
        const split = doc.splitTextToSize(line, 180);
        if (y + split.length * 6 > 280) { doc.addPage(); y = 15; }
        doc.text(split, 10, y);
        y += split.length * 6 + 2;
      });
    };
    if (backendTranscript && backendTranscript.length) {
      const lines: string[] = [];
      backendTranscript.forEach((t) => {
        lines.push(`Q${t.questionNumber}: ${t.question}`);
        lines.push(`A${t.questionNumber}: ${t.userResponse}`);
      });
      renderLines(lines);
    } else if (transcript && transcript.length) {
      transcript.forEach((msg) => {
        const who = msg.type === 'ai' ? 'AI' : 'You';
        const timeStr = new Date(msg.timestamp).toLocaleTimeString();
        renderLines([`[${timeStr}] ${who}: ${msg.content}`]);
      });
    } else {
      renderLines(['(No transcript available)']);
    }
    doc.save('interview-report.pdf');
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="glass-card p-6">
          <h1 className="text-2xl font-bold">Interview Summary</h1>
          <p className="text-sm text-muted-foreground">Generated at {new Date(generatedAt).toLocaleString()}</p>
        </Card>

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-2">Candidate</h2>
          <div className="text-sm text-muted-foreground">
            <div>Name: {user?.firstName} {user?.lastName}</div>
            <div>Email: {user?.email}</div>
            <div>Phone: {user?.phone}</div>
            <div>Duration: {Math.floor(duration / 60000)}m {Math.floor((duration % 60000) / 1000)}s</div>
          </div>
        </Card>

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-2">Transcript</h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {transcript?.map((msg: any) => (
              <div key={msg.id} className="text-sm">
                <span className="font-semibold mr-2">{msg.type === 'ai' ? 'AI' : 'You'}:</span>
                <span>{msg.content}</span>
                <span className="ml-2 text-xs text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => (window.location.href = '/')}>Start New Interview</Button>
          <Button onClick={handleDownloadPdf}>Download PDF</Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
