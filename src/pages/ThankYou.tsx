import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Home, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function ThankYou() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full"
      >
        <Card className="text-center">
          <CardContent className="p-8 space-y-6">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </motion.div>

            {/* Thank You Message */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h1 className="text-3xl font-bold text-foreground">
                Thank You!
              </h1>
              <p className="text-lg text-muted-foreground">
                Your interview has been completed successfully.
              </p>
            </motion.div>

            {/* Information Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid gap-4 mt-8"
            >
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">Interview Recorded</p>
                  <p className="text-sm text-muted-foreground">
                    Your responses have been saved and processed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium">Next Steps</p>
                  <p className="text-sm text-muted-foreground">
                    Our team will review your interview and get back to you soon
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-3 pt-6"
            >
              <Button
                onClick={() => navigate('/')}
                className="flex-1"
                size="lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
              
              <Button
                onClick={() => window.close()}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                Close Window
              </Button>
            </motion.div>

            {/* Footer Message */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="pt-4 border-t"
            >
              <p className="text-sm text-muted-foreground">
                We appreciate your time and interest in joining our team.
                <br />
                Have a great day!
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
