"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL environment variable is missing!');
    process.exit(1);
}
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const existingAdmin = await prisma.user.findFirst({
        where: { role: client_1.Role.ADMIN },
    });
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email: 'admin@cutoutexpert.com',
                name: 'Super Admin',
                password: hashedPassword,
                role: client_1.Role.ADMIN,
            },
        });
        console.log('Seeded default admin user: admin@cutoutexpert.com / admin123');
    }
    const defaultServices = [
        {
            slug: 'clipping-path',
            name: 'Clipping Path Service',
            description: "The definition of photo clipping path services differs quite substantially. It is oftentimes misinterpreted yet it's very simple, an image clipping service uses a vector image as a basis for creating edits.",
            image: '/services/1.jpg',
        },
        {
            slug: 'background-removal',
            name: 'Background Removal',
            description: 'Product marketing is very important for online stores and physical retail shops. Since most products or images contain a background, you need to remove any unwanted image data.',
            image: '/services/2.jpg',
        },
        {
            slug: 'drop-shadow',
            name: 'Drop Shadow',
            description: "What do you do when photo retouching or masking doesn't help you? You need to find new techniques of image enhancement that can enhance the visual appeal of your photos.",
            image: '/services/3.jpg',
        },
        {
            slug: 'image-masking',
            name: 'Image Masking',
            description: 'Image masking service is a very popular form of photo editing technique in demand nowadays. It is useful to know the process in detail. One thing to note is that the art of image masking is a relatively modern concept.',
            image: '/services/4.jpg',
        },
        {
            slug: 'photo-retouching',
            name: 'Photo Retouching',
            description: 'Image editing is an art in itself. Even in older times, photo retouching service was not unheard of. It was all manual then. Digital innovation has helped online photo retouching services become a household phenomenon nowadays.',
            image: '/services/5.jpg',
        },
        {
            slug: 'product-photo-editing',
            name: 'Product Photo Editing',
            description: 'Most people are not brilliant photographers. They may use state-of-the-art cameras or camera-toting smartphones to take pictures. But usually, the photos need quite a bit of editing and people need help for making a perfection.',
            image: '/services/6.jpg',
        },
        {
            slug: 'photo-manipulation',
            name: 'Photo Manipulation',
            description: "The technology ensures nothing is impossible in today's world. It can make a normal person look dapper. A perfect image is not a distant dream. Poor lighting, amateur photographers, ordinary cameras are not problems anymore.",
            image: '/services/7.jpg',
        },
        {
            slug: 'ghost-mannequin-effect',
            name: 'Ghost Mannequin Effect',
            description: 'A discussion of photo editing methods will be incomplete with talking about neck joint services. This is a very specific form of image manipulation. eCommerce businesses that sell clothes online use this method to showcase their products.',
            image: '/services/8.jpg',
        },
        {
            slug: 'color-correction',
            name: 'Color Correction',
            description: "Colors can make or break an image. A photographer might not be able to capture the colors in all their glory. It might be because of inconsistent weather, bad lighting, or incorrect camera setting. Here's where color correction service comes into play.",
            image: '/services/9.jpg',
        },
    ];
    for (const s of defaultServices) {
        const existing = await prisma.service.findUnique({
            where: { slug: s.slug },
        });
        if (!existing) {
            await prisma.service.create({
                data: {
                    slug: s.slug,
                    name: s.name,
                    description: s.description,
                    image: s.image,
                    heroHeading: `${s.name} - Professional Quality`,
                    heroDescription: `Get the absolute best ${s.name} done by our team of professional graphic designers with fast delivery and high accuracy.`,
                    heroImage: s.image,
                    profHeading: `Why Choose Our ${s.name}?`,
                    profDescription: `Our experts handle your images with ultimate precision, using advanced tools and hand-drawn paths to ensure flawless results.`,
                    profImage: s.image,
                    profFeatures: [
                        '100% Hand-drawn paths for precision',
                        'Super-fast delivery under 24 hours',
                        'Unlimited free revisions until satisfied',
                        'Special bulk orders discount up to 50%',
                    ],
                    subServices: [],
                    gallery: [],
                    pricingIntro: 'We offer simple, straightforward pricing tiers based on the complexity of your photos.',
                    pricingPlans: {
                        create: [
                            {
                                tier: 'Simple',
                                price: '$0.49',
                                description: 'Clean edges and simple shapes with straight lines or simple curves.',
                                thumbnail: s.image,
                                examples: [],
                                features: [
                                    'Clipping Path',
                                    'Color correction',
                                    'Source file delivery',
                                ],
                            },
                            {
                                tier: 'Medium',
                                price: '$1.49',
                                description: 'Multiple curves, compound shapes, or minor transparency.',
                                thumbnail: s.image,
                                examples: [],
                                features: [
                                    'Clipping Path',
                                    'Color correction',
                                    'Shadow creation',
                                    'Source file delivery',
                                ],
                            },
                            {
                                tier: 'Complex',
                                price: '$3.99',
                                description: 'Complex objects like jewelry, bicycles, or nets with a lot of curves.',
                                thumbnail: s.image,
                                examples: [],
                                features: [
                                    'Advanced masking',
                                    'Retouching',
                                    'Custom background',
                                    'Source file delivery',
                                    '24/7 VIP support',
                                ],
                            },
                        ],
                    },
                },
            });
            console.log(`Seeded service: ${s.name}`);
        }
    }
    const defaultBlogPosts = [
        {
            slug: '10-product-photo-editing-tips-to-boost-ecommerce-sales',
            title: '10 Product Photo Editing Tips to Boost E-commerce Sales',
            content: 'Product images play a massive role in whether or not an online shopper decides to make a purchase. When selling online, customers cannot touch or see your products in person, which means your photos must do all the selling. In this post, we share 10 essential product photo editing tips that will elevate your product catalog and drive more conversions.\n\n1. Ensure accurate color representation. Shoppers want to receive exactly what they saw online.\n\n2. Remove distracting backgrounds. A clean white background is the industry standard for e-commerce.\n\n3. Create realistic drop shadows to give your product depth.\n\n4. Use high-resolution crop ratios suitable for mobile views.',
            image: '/services/1.jpg',
            category: 'E-commerce',
            tags: ['e-commerce', 'product photo', 'photo editing'],
            isPublished: true,
        },
        {
            slug: 'what-is-a-clipping-path-and-why-do-you-need-it',
            title: 'What is a Clipping Path and Why Do You Need It?',
            content: 'A clipping path is a closed vector path or shape, usually drawn with the pen tool in Photoshop, used to cut out an image from its background. Once the clipping path is applied, anything inside the path is kept, and everything outside the path is omitted. This technique is widely used in product photography, advertising, and publication layouts.\n\nIf you want to achieve professional, clean edges, drawing a manual clipping path is the ultimate solution. While AI tools are improving, they often leave jagged edges on complex curves, making hand-drawn paths indispensable.',
            image: '/services/2.jpg',
            category: 'Photo Editing',
            tags: ['clipping path', 'photoshop', 'design tips'],
            isPublished: true,
        },
        {
            slug: 'the-art-of-ghost-mannequin-photography-editing',
            title: 'The Art of Ghost Mannequin Photography Editing',
            content: 'Ghost mannequin editing, also known as neck joint editing, is a crucial technique for fashion e-commerce brands. It allows you to showcase clothing products as if they are being worn by an invisible figure, giving them a three-dimensional shape and natural fit.\n\nTo achieve this effect, photographers take multiple pictures of a garment on a mannequin, including shots of the inner collar and lining. In post-production, editing artists merge these images together to create a seamless collared neck joint, providing a clean and professional presentation.',
            image: '/services/3.jpg',
            category: 'Design Tips',
            tags: ['ghost mannequin', 'neck joint', 'fashion'],
            isPublished: true,
        },
    ];
    for (const post of defaultBlogPosts) {
        const existing = await prisma.blogPost.findUnique({
            where: { slug: post.slug },
        });
        if (!existing) {
            await prisma.blogPost.create({
                data: post,
            });
            console.log(`Seeded blog post: ${post.title}`);
        }
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=seed.js.map