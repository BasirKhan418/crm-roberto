/**
 * Company-level records (company profile, Stripe Connect account, reminder settings) are
 * now read from the company owner's user ID. Before that change, an invited member could
 * have created one of these under their own user ID, where it is no longer found.
 *
 * This script finds such records. For each one:
 *  - if the company owner has no record of that type, it is moved to the owner;
 *  - otherwise it is reported as a conflict and left untouched (the owner's record wins).
 *
 * Dry run by default. Pass --apply to write changes.
 *
 *   npx tsx scripts/migrate-company-owner-records.ts            # report only
 *   npx tsx scripts/migrate-company-owner-records.ts --apply    # move records
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MONGO_URI = process.env.MONGO_URI ?? "";
const APPLY = process.argv.includes("--apply");

if (!MONGO_URI) {
  console.error("MONGO_URI is not set in .env or .env.local");
  process.exit(1);
}

type OwnerKeyedCollection = { collection: string; ownerField: "user" | "userId"; label: string };

const COLLECTIONS: OwnerKeyedCollection[] = [
  { collection: "companyprofiles", ownerField: "user", label: "Company profile" },
  { collection: "stripeconnects", ownerField: "userId", label: "Stripe Connect account" },
  { collection: "remindersettings", ownerField: "userId", label: "Reminder settings" },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection is not ready");
  }

  const users = db.collection("users");
  const companies = db.collection("companies");

  const ownerByCompany = new Map<string, mongoose.Types.ObjectId>();
  for await (const company of companies.find({}, { projection: { ownerUserId: 1 } })) {
    if (company.ownerUserId) {
      ownerByCompany.set(String(company._id), company.ownerUserId as mongoose.Types.ObjectId);
    }
  }

  const companyByUser = new Map<string, string>();
  for await (const user of users.find({ companyId: { $ne: null } }, { projection: { companyId: 1, email: 1 } })) {
    companyByUser.set(String(user._id), String(user.companyId));
  }

  let moved = 0;
  let conflicts = 0;

  for (const { collection, ownerField, label } of COLLECTIONS) {
    const records = db.collection(collection);

    for await (const record of records.find({}, { projection: { [ownerField]: 1 } })) {
      const holderId = String(record[ownerField]);
      const companyId = companyByUser.get(holderId);
      if (!companyId) continue;

      const ownerId = ownerByCompany.get(companyId);
      if (!ownerId || String(ownerId) === holderId) continue;

      const ownerHasRecord = await records.countDocuments({ [ownerField]: ownerId }, { limit: 1 });
      if (ownerHasRecord) {
        conflicts += 1;
        console.log(`[conflict] ${label} ${record._id}: held by member ${holderId}, owner ${ownerId} already has one. Left untouched.`);
        continue;
      }

      moved += 1;
      console.log(`[${APPLY ? "moved" : "would move"}] ${label} ${record._id}: member ${holderId} -> owner ${ownerId} (company ${companyId})`);
      if (APPLY) {
        await records.updateOne({ _id: record._id }, { $set: { [ownerField]: ownerId } });
      }
    }
  }

  console.log(`\n${APPLY ? "Moved" : "Would move"}: ${moved}. Conflicts (left untouched): ${conflicts}.`);
  if (!APPLY && moved > 0) {
    console.log("Re-run with --apply to move them.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
