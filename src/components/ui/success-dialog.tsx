import React from 'react';
import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function SuccessDialog() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">Show Success</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogBody className="py-8 text-center">
					<CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
					<DialogTitle className="mb-2 text-xl font-semibold">
						Payment Successful!
					</DialogTitle>
					<DialogDescription className="mb-6 text-base">
						Your subscription has been activated successfully. You now have
						access to all premium features.
					</DialogDescription>
					<div className="bg-muted/30 mb-6 rounded-lg p-4">
						<div className="mb-2 flex justify-between text-sm">
							<span>Plan:</span>
							<span className="font-medium">Pro Monthly</span>
						</div>
						<div className="mb-2 flex justify-between text-sm">
							<span>Amount:</span>
							<span className="font-medium">$29.99</span>
						</div>
						<div className="flex justify-between text-sm">
							<span>Next billing:</span>
							<span className="font-medium">Aug 23, 2025</span>
						</div>
					</div>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button className="w-full">Continue</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
