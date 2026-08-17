import { Router, type IRouter } from "express";
import { ObjectId } from "mongodb";
import {
  CreateListingBody,
  GetListingParams,
  GetListingSummaryResponse,
  ListListingsQueryParams,
  ListListingsResponse,
  UpdateListingBody,
  UpdateListingParams,
  type ListingInput,
  type ListingSummary,
} from "@workspace/api-zod";
import { getListingsCollection, type ListingDocument } from "../lib/mongodb";

const router: IRouter = Router();

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected server error";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidContactEmail(value: string | null | undefined): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeListingInput(input: ListingInput): ListingInput {
  const rentalPeriod = input.rentalPeriod ?? null;

  if (input.category === "land" && input.listingType !== "sale") {
    throw new Error("Land listings can only be marked for sale.");
  }

  if (input.category === "land" && rentalPeriod !== null) {
    throw new Error("Land listings cannot include a rental period.");
  }

  if (input.listingType === "rent" && rentalPeriod === null) {
    throw new Error("Rental listings must include a monthly or yearly period.");
  }

  if (input.listingType === "sale" && rentalPeriod !== null) {
    throw new Error("Sale listings cannot include a rental period.");
  }

  if (!isValidContactEmail(input.owner.email)) {
    throw new Error("Owner email is invalid.");
  }

  if (input.images.some((image) => !isHttpUrl(image))) {
    throw new Error("Every image must be a valid HTTP or HTTPS URL.");
  }

  return {
    ...input,
    rentalPeriod,
    owner: {
      ...input.owner,
      email: input.owner.email || null,
      additionalContact: input.owner.additionalContact || null,
    },
    location: {
      ...input.location,
      address: input.location.address || null,
      district: input.location.district || null,
    },
  };
}

function toListing(document: ListingDocument & { _id: ObjectId }) {
  return {
    id: document._id.toString(),
    title: document.title,
    category: document.category,
    listingType: document.listingType,
    description: document.description,
    price: document.price,
    rentalPeriod: document.rentalPeriod ?? null,
    owner: document.owner,
    location: document.location,
    images: document.images,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function parseObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function seedListingsIfEmpty() {
  const collection = await getListingsCollection();
  const count = await collection.countDocuments();
  if (count > 0) return;

  const now = new Date();
  const sampleListings: ListingDocument[] = [
    {
      title: "Al Narjis Garden Villa",
      category: "build",
      listingType: "sale",
      description:
        "A light-filled family villa with a private garden, generous entertaining spaces, and an easy connection to north Riyadh.",
      price: 2450000,
      rentalPeriod: null,
      owner: {
        name: "Noura Al Harbi",
        phone: "+966 55 218 4490",
        email: "noura@example.com",
        additionalContact: null,
      },
      location: {
        address: "King Abdulaziz Road",
        city: "Riyadh",
        district: "Al Narjis",
      },
      images: [
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85",
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85",
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Olaya Skyline Apartment",
      category: "apartment",
      listingType: "rent",
      description:
        "An elevated two-bedroom apartment with a bright living room, skyline views, and a short commute to the city center.",
      price: 8500,
      rentalPeriod: "monthly",
      owner: {
        name: "Faisal Properties",
        phone: "+966 54 301 7702",
        email: "hello@example.com",
        additionalContact: "WhatsApp available",
      },
      location: {
        address: "King Fahd Road",
        city: "Riyadh",
        district: "Al Olaya",
      },
      images: [
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",
      ],
      createdAt: new Date(now.getTime() - 86400000),
      updatedAt: new Date(now.getTime() - 86400000),
    },
    {
      title: "Rawdah Development Parcel",
      category: "land",
      listingType: "sale",
      description:
        "A well-positioned residential parcel with a clean title and strong access to established neighborhood amenities.",
      price: 980000,
      rentalPeriod: null,
      owner: {
        name: "Mizaan Land Desk",
        phone: "+966 50 992 1148",
        email: null,
        additionalContact: "Call for plot dimensions",
      },
      location: {
        address: "Prince Sultan Street",
        city: "Jeddah",
        district: "Al Rawdah",
      },
      images: [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85",
      ],
      createdAt: new Date(now.getTime() - 172800000),
      updatedAt: new Date(now.getTime() - 172800000),
    },
  ];

  await collection.insertMany(sampleListings);
}

router.get("/listings", async (req, res) => {
  try {
    const query = ListListingsQueryParams.parse(req.query);
    const collection = await getListingsCollection();
    await seedListingsIfEmpty();

    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.listingType) filter.listingType = query.listingType;
    if (query.search?.trim()) {
      const search = new RegExp(escapeRegex(query.search.trim()), "i");
      filter.$or = [
        { title: search },
        { "location.city": search },
        { "location.district": search },
        { "location.address": search },
      ];
    }

    const documents = await collection
      .find(filter)
      .sort({ [query.sort]: query.order === "asc" ? 1 : -1 })
      .toArray();

    res.json(ListListingsResponse.parse(documents.map(toListing)));
  } catch (error) {
    req.log.error({ err: error }, "Failed to list listings");
    res.status(500).json({ error: "Unable to load listings." });
  }
});

router.get("/listings/summary", async (req, res) => {
  try {
    const collection = await getListingsCollection();
    await seedListingsIfEmpty();
    const [total, builds, apartments, lands, sale, rent] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ category: "build" }),
      collection.countDocuments({ category: "apartment" }),
      collection.countDocuments({ category: "land" }),
      collection.countDocuments({ listingType: "sale" }),
      collection.countDocuments({ listingType: "rent" }),
    ]);

    const summary: ListingSummary = {
      total,
      builds,
      apartments,
      lands,
      sale,
      rent,
    };
    res.json(GetListingSummaryResponse.parse(summary));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load listing summary");
    res.status(500).json({ error: "Unable to load listing summary." });
  }
});

router.get("/listings/:id", async (req, res) => {
  try {
    const params = GetListingParams.parse(req.params);
    const objectId = parseObjectId(params.id);
    if (!objectId) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    const collection = await getListingsCollection();
    const document = await collection.findOne({ _id: objectId });
    if (!document) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    res.json(toListing(document as ListingDocument & { _id: ObjectId }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load listing");
    res.status(500).json({ error: "Unable to load listing." });
  }
});

router.post("/listings", async (req, res) => {
  try {
    const input = normalizeListingInput(CreateListingBody.parse(req.body));
    const now = new Date();
    const document: ListingDocument = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    const collection = await getListingsCollection();
    const result = await collection.insertOne(document);
    const created = await collection.findOne({ _id: result.insertedId });

    if (!created) {
      res.status(500).json({ error: "Listing was created but could not be read." });
      return;
    }
    res.status(201).json(toListing(created as ListingDocument & { _id: ObjectId }));
  } catch (error) {
    req.log.warn({ err: error }, "Invalid listing create request");
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.patch("/listings/:id", async (req, res) => {
  try {
    const params = UpdateListingParams.parse(req.params);
    const objectId = parseObjectId(params.id);
    if (!objectId) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    const input = normalizeListingInput(UpdateListingBody.parse(req.body));
    const collection = await getListingsCollection();
    const updatedAt = new Date();
    const updateResult = await collection.updateOne(
      { _id: objectId },
      { $set: { ...input, updatedAt } },
    );

    if (updateResult.matchedCount === 0) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    const updated = await collection.findOne({ _id: objectId });
    if (!updated) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }
    res.json(toListing(updated as ListingDocument & { _id: ObjectId }));
  } catch (error) {
    req.log.warn({ err: error }, "Invalid listing update request");
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.delete("/listings/:id", async (req, res) => {
  try {
    const params = GetListingParams.parse(req.params);
    const objectId = parseObjectId(params.id);
    if (!objectId) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    const collection = await getListingsCollection();
    const result = await collection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete listing");
    res.status(500).json({ error: "Unable to delete listing." });
  }
});

export default router;