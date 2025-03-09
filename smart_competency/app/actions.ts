"use server";

import { z } from "zod";
import { requireUser } from "./utils/hooks";
import { companySchema, jobSchema, jobSeekerSchema } from "./utils/zodSchemas";
import { prisma } from "./utils/db";
import { redirect } from "next/navigation";

// import { stripe } from "./utils/stripe";
// import { jobListingDurationPricing } from "./utils/pricingTiers";

import { revalidatePath } from "next/cache";

// import arcjet, { detectBot, shield } from "./utils/arcjet";
// import { request } from "@arcjet/next";
// import { inngest } from "./utils/inngest/client";

// const aj = arcjet
//     .withRule(
//         shield({
//             mode: "LIVE",
//         })
//     )
//     .withRule(
//         detectBot({
//             mode: "LIVE",
//             allow: [],
//         })
//     );

export async function createCompany(data: z.infer<typeof companySchema>) {
    const user = await requireUser();

    // // Access the request object so Arcjet can analyze it
    // const req = await request();
    // // Call Arcjet protect
    // const decision = await aj.protect(req);

    // if (decision.isDenied()) {
    //     throw new Error("Forbidden");
    // }

    // Server-side validation
    const validatedData = companySchema.parse(data);

    console.log(validatedData);

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            onboardingCompleted: true,
            userType: "COMPANY",
            Company: {
                create: {
                    ...validatedData,
                },
            },
        },
    });

    return redirect("/");
}

export async function createJobSeeker(data: z.infer<typeof jobSeekerSchema>) {
    const user = await requireUser();

    // // Access the request object so Arcjet can analyze it
    // const req = await request();
    // // Call Arcjet protect
    // const decision = await aj.protect(req);

    // if (decision.isDenied()) {
    //     throw new Error("Forbidden");
    // }

    const validatedData = jobSeekerSchema.parse(data);

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            onboardingCompleted: true,
            userType: "JOB_SEEKER",
            JobSeeker: {
                create: {
                    ...validatedData,
                },
            },
        },
    });

    return redirect("/");
}

export async function createJob(data: z.infer<typeof jobSchema>) {
    try {
        console.log("createJob: Starting with data:", data);
        const user = await requireUser();
        console.log("createJob: User:", user);

        const validatedData = jobSchema.parse(data);
        console.log("createJob: Validated data:", validatedData);

        const company = await prisma.company.findUnique({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
                user: {
                    select: {
                        stripeCustomerId: true,
                    },
                },
            },
        });
        console.log("createJob: Company:", company);

        if (!company?.id) {
            console.log("createJob: Company not found, redirecting");
            return redirect("/");
        }

        const jobPost = await prisma.jobPost.create({
            data: {
                companyId: company.id,
                jobDescription: validatedData.jobDescription,
                jobTitle: validatedData.jobTitle,
                employmentType: validatedData.employmentType,
                location: validatedData.location,
                salaryFrom: validatedData.salaryFrom,
                salaryTo: validatedData.salaryTo,
                listingDuration: validatedData.listingDuration,
                benefits: validatedData.benefits,
            },
        });
        console.log("createJob: Job post created:", jobPost);

        return redirect("/my-jobs");
    } catch (error) {
        console.error("createJob: Error:", error);
        if (error instanceof Error) {
            console.error("createJob: Error message:", error.message);
            console.error("createJob: Error Stack:", error.stack);
        }
        throw error; // Re-throw the error to be caught by the client
    }
}
export async function updateJobPost(
    data: z.infer<typeof jobSchema>,
    jobId: string
) {
    const user = await requireUser();

    const validatedData = jobSchema.parse(data);

    await prisma.jobPost.update({
        where: {
            id: jobId,
            company: {
                userId: user.id,
            },
        },
        data: {
            jobDescription: validatedData.jobDescription,
            jobTitle: validatedData.jobTitle,
            employmentType: validatedData.employmentType,
            location: validatedData.location,
            salaryFrom: validatedData.salaryFrom,
            salaryTo: validatedData.salaryTo,
            listingDuration: validatedData.listingDuration,
            benefits: validatedData.benefits,
        },
    });

    return redirect("/my-jobs");
}

export async function deleteJobPost(jobId: string) {
    const user = await requireUser();

    await prisma.jobPost.delete({
        where: {
            id: jobId,
            company: {
                userId: user.id,
            },
        },
    });

    return redirect("/my-jobs");
}

export async function saveJobPost(jobId: string) {
    const user = await requireUser();

    await prisma.savedJobPost.create({
        data: {
            jobId: jobId,
            userId: user.id as string,
        },
    });

    revalidatePath(`/job/${jobId}`);
}

export async function unsaveJobPost(savedJobPostId: string) {
    const user = await requireUser();

    const data = await prisma.savedJobPost.delete({
        where: {
            id: savedJobPostId,
            userId: user.id as string,
        },
        select: {
            jobId: true,
        },
    });

    revalidatePath(`/job/${data.jobId}`);
}