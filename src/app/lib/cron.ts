import cron from "node-cron";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";
import { prisma } from "./prisma";

cron.schedule("*/10 * * * *", () => {
	console.log("Delete unverified doctores after every 10 minutes.");
});

export const deleteUnverifiedDoctors = async () => {
	cron.schedule("*/10 * * * *", async () => {
		// console.log("Delete unverified doctores after every 10 seconds.");

		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

			const deletedDoctors = await prisma.user.deleteMany({
				where: {
					role: Role.DOCTOR,
					emailVerified: false,
					createdAt: { lt: oneHourAgo },
					doctor: {
						verificationStatus: DoctorVerificationStatus.PENDING,
					},
				},
			});

			if (deletedDoctors.count > 0) {
				console.log(`
                Cron: Deleted ${deletedDoctors.count} unverified doctor application older than 1 hour!
                `);
			}
		} catch (error) {
			console.log(
				"Cron failed to delete unverified doctor applications: ",
				error,
			);
		}
		console.log("Unverified Doctor Delete Cron Schedule (Every 10 minutes)");
	});
};
