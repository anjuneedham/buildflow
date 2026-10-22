import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { getRegions, getServices } from "@/lib/queries";
import { requireBusiness } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Edit profile" };

export default async function ProfilePage() {
  const s = await requireBusiness();
  const [services, regions] = await Promise.all([getServices(), getRegions(s.business.country_code)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Business profile" subtitle="This is your mini-website. Make it easy to say yes to you."
        actions={<ButtonLink href={`/contractor/${s.business.slug}`} variant="outline" size="sm">View public profile</ButtonLink>} />
      {!s.isOwner ? <Card className="p-4 text-sm text-ink-500">Only the business owner can edit the profile.</Card> : (
        <ProfileForm business={s.business} services={services} regions={regions} selected={s.business.service_ids ?? []} />
      )}
    </div>
  );
}
