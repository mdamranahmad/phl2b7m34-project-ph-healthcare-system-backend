import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},
					async (error, result) => {
						if (error) {
							console.log("uploadProfileImage error: ", error);
							// throw new Error(error.message);
							return reject(error);
						}

						if (!result) {
							throw new Error("No result from Cloudinary!");
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},
		data: {
			imageUrl: cloudinaryResult?.secure_url,
			imagePublicId: cloudinaryResult?.public_id,
		},
		omit: {
			password: true,
		},
	});

	return updatedUser;
};

export const UserServices = {
	uploadProfileImage,
};
