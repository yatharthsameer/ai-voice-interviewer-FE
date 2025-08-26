import { z } from "zod";

// Application form schema
export const applicationSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters").max(40, "First name must be less than 40 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters").max(40, "Last name must be less than 40 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone number").max(15, "Phone number is too long"),
  position: z.enum(["Caregiver", "Registered Nurse", "Therapist"], {
    required_error: "Please select a position",
  }),
  hhaExperience: z.boolean({
    required_error: "Please select an option",
  }),
  cprCertified: z.boolean({
    required_error: "Please select an option",
  }),
  driversLicense: z.boolean({
    required_error: "Please select an option",
  }),
  autoInsurance: z.boolean({
    required_error: "Please select an option",
  }),
  reliableTransport: z.boolean({
    required_error: "Please select an option",
  }),
  locationPref: z.string().max(280, "Location preference is too long").optional(),
  availability: z.array(
    z.enum(["Mornings", "Afternoons", "Evenings", "Overnights", "Weekends"])
  ).min(1, "Please select at least one availability option"),
  weeklyHours: z.number().int().min(5, "Minimum 5 hours per week").max(80, "Maximum 80 hours per week"),
});

export type ApplicationData = z.infer<typeof applicationSchema>;

// Device setup schema
export const deviceSetupSchema = z.object({
  cameraId: z.string().optional(),
  microphoneId: z.string().optional(),
  speakerId: z.string().optional(),
  hasVideoStream: z.boolean(),
  hasAudioStream: z.boolean(),
});

export type DeviceSetupData = z.infer<typeof deviceSetupSchema>;

// Combined form data
export const interviewDataSchema = z.object({
  application: applicationSchema,
  deviceSetup: deviceSetupSchema,
});

export type InterviewData = z.infer<typeof interviewDataSchema>;