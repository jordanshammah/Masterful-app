import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AccountBillingProps {
  userId: string;
}

const AccountBilling = ({ userId }: AccountBillingProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Billing Information</h2>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Manage your payment methods and billing information
        </p>
        <div className="border-t pt-4">
          <Button variant="outline" className="w-full">
            Add Payment Method
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          Payment integration coming soon
        </div>
      </div>
    </Card>
  );
};

export default AccountBilling;
