import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgetPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyPatientEmailPayload,
} from "./auth.interface";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;

	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	// Store User Data in Redis

	const expirationSeconds = 5 * 60;

	const otpKey = `patient-registration-otp: ${email}`;
	const otp = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otp, {
		expiration: { type: "EX", value: expirationSeconds },
	});

	// while passing redisUserDataPayload on redisClient, tha data has to be stringified
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		patient: patientData,
	};

	const patientRegistrationKey = `patient-registration-data: ${email}`;

	await redisClient.set(
		patientRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: { type: "EX", value: expirationSeconds },
		},
	);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);

	const templateData = {
		name: name,
		email: email,
		OTP: otp,
		expiresIn: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification",
		html,
	});
	/**
    const createdUser = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: Role.PATIENT,
            status: UserStatus.ACTIVE,
            emailVerified: false,
            patient: {
                create: {
                    name,
                    email,
                    contactNumber: patientData.contactNumber || "",
                },
            },
        },
        omit: { password: true },
        include: { patient: true },
    });

    const { patient, ...user } = createdUser;
    const jwtPayload = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in as SignOptions,
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in as SignOptions,
    );

    return {
        user,
        patient,
        accessToken,
        refreshToken,
    };
     */
};

const verifyPatientEmail = async (payload: IVerifyPatientEmailPayload) => {
	const email = payload.email.trim().toLowerCase();

	const otp = payload.otp;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists?.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}

	if (isUserExists?.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Email Already Varified!");
	}

	if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}

	// if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
	//     throw new AppError(httpStatus.CONFLICT, "User Has Account With Google!");
	// }

	const otpKey = `patient-registration-otp: ${email}`;

	const redisOTP = await redisClient.get(otpKey);

	if (!redisOTP) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid OTP!");
	}

	if (redisOTP !== otp) {
		throw new AppError(httpStatus.UNAUTHORIZED, "OTP does not match!");
	}

	await redisClient.del(otpKey);

	const patientRegistrationKey = `patient-registration-data: ${email}`;

	const redisPatientData = await redisClient.get(patientRegistrationKey);

	if (!redisPatientData) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Patient Data!");
	}

	const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);

	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name: patientPayload.name,
					email: patientPayload.email,
					contactNumber: patientPayload.patient.contactNumber || "",
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del(patientRegistrationKey);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/patient-welcome-email.ejs",
	);

	const templateData = {
		name: createdUser.name,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: createdUser.email,
		subject: "Welcome to PH Healthcare System!",
		html,
	});

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		// throw new AppError(httpStatus.NOT_FOUND, "User not found");
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Please log in with Google!");
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google Id Toekn Verification Failed!", error);
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or Expired Google Id Token!",
		);
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or Expired Google Id Token!",
		);
	}

	if (!googleIdTokenPayload.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email Not Found!");
	}

	if (!googleIdTokenPayload.name) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Name Not Found!");
	}

	const ifPatientExistsWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = ifPatientExistsWithGoogleAuth;

	if (!ifPatientExistsWithGoogleAuth) {
		const ifPatientExistsWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (ifPatientExistsWithCredentials) {
			if (!ifPatientExistsWithCredentials.emailVerified) {
				throw new AppError(httpStatus.BAD_REQUEST, "Email not Varified!");
			}

			if (ifPatientExistsWithCredentials.status === UserStatus.BLOCKED) {
				throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
			}

			if (
				ifPatientExistsWithCredentials.isDeleted ||
				ifPatientExistsWithCredentials.status === UserStatus.DELETED
			) {
				throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
			}

			user = await prisma.user.update({
				where: {
					id: ifPatientExistsWithCredentials.id,
				},
				data: {
					googleId: googleIdTokenPayload.sub,
				},
			});
		} else {
			// Google Register
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});

			const templatePath = path.join(
				process.cwd(),
				"src/app/templates/patient-welcome-email.ejs",
			);

			const templateData = {
				name: user.name,
			};

			const html = await ejs.renderFile(templatePath, templateData);

			await transporter.sendMail({
				from: config.email_sender,
				to: user.email,
				subject: "Welcome to PH Healthcare System!",
				html,
			});
		}
	}

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found!");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}

	const jwtPayload = {
		userId: user?.id,
		name: user?.name,
		email: user?.email,
		role: user?.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const forgetPassword = async (payload: IForgetPasswordPayload) => {
	const { email } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exists!");
	}

	if (isUserExists.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}

	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Email Not Varified!");
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}

	if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
		throw new AppError(httpStatus.CONFLICT, "User Has Account With Google!");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const key = `forget-password-otp:${isUserExists.email}`;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: 5 * 60,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forget-password.ejs",
	);

	const templateData = {
		name: isUserExists.name,
		expiresIn: 5,
		OTP: otp,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forget Password",
		// text: `Your OTP is ${otp}`,
		// html: `<h1>Your OTP is ${otp}</h1>`,
		html,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exists!");
	}

	if (isUserExists.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked!");
	}

	if (!isUserExists.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Email Not Varified!");
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new AppError(httpStatus.NOT_FOUND, "User is Deleted!");
	}

	if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
		throw new AppError(httpStatus.CONFLICT, "User Has Account With Google!");
	}

	const key = `forget-password-otp:${isUserExists.email}`;

	const redisOTP = await redisClient.get(key);

	if (!redisOTP) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid OTP!");
	}

	if (redisOTP !== otp) {
		throw new AppError(httpStatus.UNAUTHORIZED, "OTP does not match!");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: { email: isUserExists.email },
		data: {
			password: hashedNewPassword,
		},
	});

	await redisClient.del([key]);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password.ejs",
	);

	const templateData = {
		name: isUserExists.name,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Password Reset Successfully.",
		// text: `Your OTP is ${otp}`,
		// html: `<h1>Your changed your password</h1>`,
		html,
	});
};

export const AuthService = {
	registerPatient,
	verifyPatientEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgetPassword,
	resetPassword,
};
