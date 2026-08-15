import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const seedSuperAdmin = async () => {
    try {
        const isSuperAdminExists = await prisma.user.findFirst({
            where: { role: Role.SUPER_ADMIN },
        });

        if (isSuperAdminExists) {
            console.log("Super Admin Already Exists.");
            return;
        }

        const name = config.super_admin_name;
        const email = config.super_admin_email;
        const password = config.super_admin_password;

        if (!name || !email || !password) {
            throw new Error("Super Admin Name, Email, Password Not Found!");
        }

        const hashedPassword = await bcrypt.hash(
            password,
            Number(config.bcrypt_salt_rounds),
        );

        const superAdmin = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
                needPasswordChange: false,
                emailVerified: true,
            },
        });

        console.log("Super Admin Created: ", superAdmin);
    } catch (error) {
        console.log("Error Seeding Super Admin: ", error);

        await prisma.user.delete({
            where: {
                email: config.super_admin_email,
            },
        });
    }
};

// export const seedTesterDoctor = async () => {
//     try {
//         const isSuperAdminExists = await prisma.user.findFirst({
//             where: { role: Role.SUPER_ADMIN },
//         });

//         if (isSuperAdminExists) {
//             console.log("Super Admin Already Exists.");
//             return;
//         }

//         const name = config.super_admin_name;
//         const email = config.super_admin_email;
//         const password = config.super_admin_password;

//         if (!name || !email || !password) {
//             throw new Error("Super Admin Name, Email, Password Not Found!");
//         }

//         const hashedPassword = await bcrypt.hash(
//             password,
//             Number(config.bcrypt_salt_rounds),
//         );

//         const superAdmin = await prisma.user.create({
//             data: {
//                 name,
//                 email,
//                 password: hashedPassword,
//                 role: Role.SUPER_ADMIN,
//                 needPasswordChange: false,
//                 emailVerified: true,
//             },
//         });

//         console.log("Super Admin Created: ", superAdmin);
//     } catch (error) {
//         console.log("Error Seeding Super Admin: ", error);

//         await prisma.user.delete({
//             where: {
//                 email: config.super_admin_email,
//             },
//         });
//     }
// };
