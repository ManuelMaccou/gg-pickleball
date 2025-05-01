"use client";

import {
  Button,
  Dialog,
  Flex,
  Text,
  Progress,
  VisuallyHidden,
} from "@radix-ui/themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/app/contexts/UserContext";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SerializedAchievement } from "../types/databaseTypes";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";

interface UserEarnedData {
  userId: string;
  achievements: SerializedAchievement[];
  rewards: {
    rewardId: string;
    name: string;
    product: string;
    discount: string;
  }[];
}

type Step =
  | { type: "message" }
  | { type: "achievement"; data: SerializedAchievement }
  | {
      type: "reward";
      data: {
        rewardId: string;
        name: string;
        product: string;
        discount: string;
      };
    };

interface SuccessDialogProps {
  showDialog: boolean;
  userEarnedData: UserEarnedData | null;
  setShowDialog: (value: boolean) => void;
}

export default function SuccessDialog({
  showDialog,
  setShowDialog,
  userEarnedData,
}: SuccessDialogProps) {
  const router = useRouter();
  const { user } = useUserContext();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>({ type: "message" });
  const [timerKey, setTimerKey] = useState(0);

  const steps: Step[] = useMemo(() => [
    { type: "message" },
    ...(userEarnedData?.achievements.map((a): Step => ({ type: "achievement", data: a })) ?? []),
    ...(userEarnedData?.rewards.map((r): Step => ({ type: "reward", data: r })) ?? []),
  ], [userEarnedData]);

  useEffect(() => {
    if (!showDialog || steps.length <= 1 || currentIndex >= steps.length - 1) return;
  
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, steps.length - 1));
      setTimerKey((prev) => prev + 1);
    }, 5000);
  
    return () => clearTimeout(timer);
  }, [showDialog, currentIndex, steps.length]);

  useEffect(() => {
    setCurrentStep(steps[currentIndex]);
  }, [currentIndex, steps]);

  return (
    <Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
      <Dialog.Content maxWidth="450px">
        <VisuallyHidden>
          <Dialog.Title>Post-match summary</Dialog.Title>
          <Dialog.Description>Post-match summary</Dialog.Description>
        </VisuallyHidden>
        <Flex direction={'column'} gap={'5'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.4 }}
            >
              <Flex direction="column" gap="6" align="center">
                {currentStep.type === "message" && (
                  <>
                    <Text size="8" weight={'bold'} mb={'-4'}>✅</Text>
                    <Text size="6" weight={'bold'} mb={'6'}>Match successfully saved</Text>
                  </>
                  
                )}

                {currentStep.type === "achievement" && (
                  <Flex direction="column" gap="3" align="center">
                    <Text size="5" weight="bold">
                      Achievement Unlocked
                    </Text>
                    <Flex position={'relative'}>
                      <Image
                        src={currentStep.data.badge}
                        alt=""
                        height={500}
                        width={500}
                        style={{height: "150px", width: '150px'}}
                      />
                    </Flex>
                  </Flex>
                )}

                {currentStep.type === "reward" && (
                  <Flex direction="column" align="center">
                    <Text size="5" weight="bold" mb={'3'}>You&apos;ve earned a reward!</Text>
                    <Text size="6" weight={'bold'} style={{textTransform: "uppercase"}}>
                      {currentStep.data.discount}
                    </Text>
                    <Text size="6" weight={'bold'} style={{textTransform: "uppercase"}}>
                      {currentStep.data.product}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </motion.div>
          </AnimatePresence>

          {steps.length > 1 && (
            <>
              <Flex direction={'column'}>
                <Progress key={timerKey} duration="7s" />
              </Flex>
            
              <Flex direction={'row'} justify={'between'}>
                <Button
                  variant="ghost" 
                  onClick={() => {
                    setCurrentIndex((i) => Math.max(i - 1, 0));
                  }}
                  style={{ outline: "none", boxShadow: "none" }}
                >
                  <ArrowLeft /> Previous
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setCurrentIndex((i) => Math.min(i + 1, steps.length - 1))}
                  style={{ outline: "none", boxShadow: "none" }}
                >
                  Next <ArrowRight />
                </Button>
              </Flex>
            </>
          )}

          
          <Flex direction="column" gap="7" mt="6">
            {user && user.isGuest && (
              <>
                <Text align={'center'}>
                  You&apos;re currently logged in as a guest. To ensure your achievements and rewards remain available, 
                  create an account.
                </Text>
                <Button onClick={() => router.push("/auth/login?screen_hint=signup&returnTo=/")}>
                  Create account
                </Button>
              </>
             
            )}
        
            <Button variant={user?.isGuest ? 'outline' : 'solid'} asChild>
              <Link href="/">Continue</Link>
            </Button>
           
          </Flex>
        </Flex>
        
      </Dialog.Content>
    </Dialog.Root>
  );
}
