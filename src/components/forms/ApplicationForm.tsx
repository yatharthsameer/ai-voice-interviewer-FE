import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import PhoneInput from "react-phone-number-input/input";
import 'react-phone-number-input/style.css';

import { applicationSchema, ApplicationData } from "@/lib/schema";
import { useInterview, interviewActions } from "@/lib/store.tsx";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

export default function ApplicationForm() {
  const { state, dispatch } = useInterview();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<ApplicationData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      firstName: state.application?.firstName || "",
      lastName: state.application?.lastName || "",
      email: state.application?.email || "",
      phone: state.application?.phone || "",
      position: state.application?.position || undefined,
      hhaExperience: state.application?.hhaExperience || undefined,
      cprCertified: state.application?.cprCertified || undefined,
      driversLicense: state.application?.driversLicense || undefined,
      autoInsurance: state.application?.autoInsurance || undefined,
      reliableTransport: state.application?.reliableTransport || undefined,
      locationPref: state.application?.locationPref || "",
      availability: state.application?.availability || [],
      weeklyHours: state.application?.weeklyHours || 30,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = form;

  const watchedData = watch();

  // Auto-save to store on form changes
  React.useEffect(() => {
    dispatch(interviewActions.updateApplication(watchedData));
  }, [watchedData, dispatch]);

  const onSubmit = async (data: ApplicationData) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      dispatch(interviewActions.updateApplication(data));
      dispatch(interviewActions.markApplicationComplete(true));
      dispatch(interviewActions.setStep(2));
      
      toast({
        title: "Application saved!",
        description: "Your application has been successfully submitted.",
      });
      
      navigate("/interview");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const availabilityOptions = ["Mornings", "Afternoons", "Evenings", "Overnights", "Weekends"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="form-container"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tell us about you</h1>
        <p className="text-muted-foreground">A few quick details to match you with roles.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              {...register("firstName")}
              autoComplete="given-name"
              className={errors.firstName ? "border-destructive" : ""}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              {...register("lastName")}
              autoComplete="family-name"
              className={errors.lastName ? "border-destructive" : ""}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            autoComplete="email"
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
          <p className="text-xs text-muted-foreground">We'll use this to send you interview updates</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Cell Phone Number *</Label>
          <PhoneInput
            id="phone"
            country="US"
            value={watchedData.phone}
            onChange={(value) => setValue("phone", value || "")}
            className={`PhoneInputInput ${errors.phone ? "border-destructive" : ""}`}
            inputMode="tel"
            autoComplete="tel"
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
          <p className="text-xs text-muted-foreground">For interview scheduling and urgent communications</p>
        </div>

        {/* Position */}
        <div className="space-y-3">
          <Label>Which position are you applying for? *</Label>
          <RadioGroup
            value={watchedData.position}
            onValueChange={(value) => setValue("position", value as ApplicationData["position"])}
            className="grid grid-cols-1 gap-3"
          >
            {["Caregiver", "Registered Nurse", "Therapist"].map((position) => (
              <div key={position} className="flex items-center space-x-2">
                <RadioGroupItem value={position} id={position} />
                <Label htmlFor={position} className="font-normal cursor-pointer">
                  {position}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {errors.position && (
            <p className="text-sm text-destructive">{errors.position.message}</p>
          )}
        </div>

        {/* Experience Questions */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Do you have experience working as a home health aide? *</Label>
            <RadioGroup
              value={watchedData.hhaExperience?.toString()}
              onValueChange={(value) => setValue("hhaExperience", value === "true")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="hha-yes" />
                <Label htmlFor="hha-yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="hha-no" />
                <Label htmlFor="hha-no" className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
            {errors.hhaExperience && (
              <p className="text-sm text-destructive">{errors.hhaExperience.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Do you have a current CPR/First aid certification? *</Label>
            <RadioGroup
              value={watchedData.cprCertified?.toString()}
              onValueChange={(value) => setValue("cprCertified", value === "true")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="cpr-yes" />
                <Label htmlFor="cpr-yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="cpr-no" />
                <Label htmlFor="cpr-no" className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
            {errors.cprCertified && (
              <p className="text-sm text-destructive">{errors.cprCertified.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Driver's License & ID *</Label>
            <RadioGroup
              value={watchedData.driversLicense?.toString()}
              onValueChange={(value) => setValue("driversLicense", value === "true")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="license-yes" />
                <Label htmlFor="license-yes" className="font-normal cursor-pointer">
                  Yes, I have a current and valid driver's license
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="license-no" />
                <Label htmlFor="license-no" className="font-normal cursor-pointer">
                  No, I do not have a driver's license at this time
                </Label>
              </div>
            </RadioGroup>
            {errors.driversLicense && (
              <p className="text-sm text-destructive">{errors.driversLicense.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Auto Insurance *</Label>
            <RadioGroup
              value={watchedData.autoInsurance?.toString()}
              onValueChange={(value) => setValue("autoInsurance", value === "true")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="insurance-yes" />
                <Label htmlFor="insurance-yes" className="font-normal cursor-pointer">
                  Yes, I have auto insurance
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="insurance-no" />
                <Label htmlFor="insurance-no" className="font-normal cursor-pointer">
                  No, I do not have auto insurance at this time
                </Label>
              </div>
            </RadioGroup>
            {errors.autoInsurance && (
              <p className="text-sm text-destructive">{errors.autoInsurance.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Do you have reliable transportation? *</Label>
            <RadioGroup
              value={watchedData.reliableTransport?.toString()}
              onValueChange={(value) => setValue("reliableTransport", value === "true")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="transport-yes" />
                <Label htmlFor="transport-yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="transport-no" />
                <Label htmlFor="transport-no" className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
            {errors.reliableTransport && (
              <p className="text-sm text-destructive">{errors.reliableTransport.message}</p>
            )}
          </div>
        </div>

        {/* Location Preference */}
        <div className="space-y-2">
          <Label htmlFor="locationPref">Do you have a location preference (zones) in the city?</Label>
          <Textarea
            id="locationPref"
            {...register("locationPref")}
            placeholder="e.g., Northwest, Midtown, ZIPs 30308/30309"
            className="min-h-[80px]"
          />
          {errors.locationPref && (
            <p className="text-sm text-destructive">{errors.locationPref.message}</p>
          )}
        </div>

        {/* Availability */}
        <div className="space-y-3">
          <Label>What are your available hours to work? *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availabilityOptions.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`availability-${option}`}
                  checked={watchedData.availability?.includes(option as any)}
                  onCheckedChange={(checked) => {
                    const current = watchedData.availability || [];
                    if (checked) {
                      setValue("availability", [...current, option as any]);
                    } else {
                      setValue("availability", current.filter(item => item !== option));
                    }
                  }}
                />
                <Label htmlFor={`availability-${option}`} className="font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
          {errors.availability && (
            <p className="text-sm text-destructive">{errors.availability.message}</p>
          )}
        </div>

        {/* Weekly Hours */}
        <div className="space-y-4">
          <Label>How many hours would you like to work a week? *</Label>
          <div className="space-y-4">
            <Slider
              value={[watchedData.weeklyHours]}
              onValueChange={([value]) => setValue("weeklyHours", value)}
              max={80}
              min={5}
              step={1}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>5 hours</span>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min={5}
                  max={80}
                  value={watchedData.weeklyHours}
                  onChange={(e) => setValue("weeklyHours", parseInt(e.target.value) || 5)}
                  className="w-20 text-center"
                />
                <span>hours/week</span>
              </div>
              <span>80 hours</span>
            </div>
          </div>
          {errors.weeklyHours && (
            <p className="text-sm text-destructive">{errors.weeklyHours.message}</p>
          )}
        </div>

        {/* Privacy Notice */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Your information is used only for hiring purposes and is never sold or shared with third parties.
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Application...
              </>
            ) : (
              "Next: Interview Setup"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}