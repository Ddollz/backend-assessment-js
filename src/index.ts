/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { neon } from '@neondatabase/serverless';
export interface Env {
	CON_STRING: string;
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		let result = await handleRequest(request, env)
		return result;
	},
};


async function handleRequest(request: Request, env: Env) {
	const sql = neon(env.CON_STRING!);
	const { pathname, searchParams } = new URL(request.url);
	const urlParams = searchParams.get("id");
	if (pathname.startsWith("/api/products") && request.method == "GET") {
		console.log(request)
		const res = await fetch("https://02557f4d-8f03-405d-a4e7-7a6483d26a04.mock.pstmn.io/get")
			.then(res => res.json())
			.then((data: any) => data);
		let newProductCount = 0
		let sqlString = "INSERT INTO products (title, tags, created_at, updated_at, sku) VALUES"
		for (let index = 0; index < res.products.length; index++) {
			const product = res.products[index];
			for (let variantIndex = 0; variantIndex < product.variants.length; variantIndex++) {
				const variant = product.variants[variantIndex];

				const ifExists = await sql("SELECT * FROM products WHERE sku = '" + variant.sku + "'" + " AND title = '" + product.title + " " + variant.title + "'");
				if (ifExists.length < 1) {
					newProductCount++;
					let stringCon = "('" + product.title + " " + variant.title + "','" + product.tags + "','" + variant.created_at + "','" + variant.updated_at + "','" + variant.sku + "'),"
					if (index == res.products.length - 1 && variantIndex == product.variants.length - 1) {
						stringCon = stringCon.slice(0, -1)
						stringCon = stringCon + "RETURNING *;"
					}
					sqlString = sqlString + stringCon
				}
			}
		}
		// ? Uncomment when start
		if (newProductCount > 0) {
			const posts = await sql(sqlString);
			return new Response(JSON.stringify(posts), { headers: { "content-type": "application/json" } });
		} else {
			return new Response(JSON.stringify("Already Imported"), { headers: { "content-type": "application/json" } });

		}
		// return new Response(JSON.stringify({"message": "success"}), { headers: { "content-type": "application/json" } });
	}
	else if (pathname.startsWith("/api/products/postSingle") && request.method == "POST") {
		const reqBody = JSON.parse(await readRequestBody(request));

		if (!reqBody) return new Response(JSON.stringify({ "message": "Error in request" }), { headers: { "content-type": "application/json" } });
		console.log(reqBody)
		if (!reqBody.Title || !reqBody.Tags || !reqBody.ProductCode) return new Response(JSON.stringify({ "message": "There are missing fields" }), { headers: { "content-type": "application/json" } });
		const ifExists = await sql("SELECT * FROM products WHERE sku = '" + reqBody.ProductCode + "'" + " AND title = '" + reqBody.Title + "'");
		if (ifExists.length < 1) {
			let sqlString = `INSERT INTO products (title, tags, sku) VALUES ('${reqBody?.Title}', '${reqBody?.Tags}', '${reqBody?.ProductCode}') RETURNING *;`
			const posts = await sql(sqlString);
			return new Response(JSON.stringify(posts), { headers: { "content-type": "application/json" } });
		} else {
			return new Response(JSON.stringify({ "message": "Dupplication found" }), { headers: { "content-type": "application/json" } });
		}
	}
	else if (pathname.startsWith("/api/products") && request.method == "POST") {
		const res = await fetch("https://02557f4d-8f03-405d-a4e7-7a6483d26a04.mock.pstmn.io/getProducts")
			.then(res => res.json())
			.then((data: any) => data);
		let sqlString = "INSERT INTO products (title, tags, created_at, updated_at, sku) VALUES"
		let newProductCount = 0
		for (let index = 0; index <= res.products.length; index++) {
			const product = res.products[index];
			if (!product) { continue }
			for (let variantIndex = 0; variantIndex <= product.variants.length; variantIndex++) {
				const variant = product.variants[variantIndex];
				if (!variant) { continue }
				const ifExists = await sql("SELECT * FROM products WHERE sku = '" + variant.sku + "'" + " AND title = '" + product.title + " " + variant.title + "'");
				if (ifExists.length < 1) {
					newProductCount = newProductCount + 1
					let stringCon = "('" + product.title + " " + variant.title + "','" + product.tags + "','" + variant.created_at + "','" + variant.updated_at + "','" + variant.sku + "'),"
					if (index == res.products.length - 1 && variantIndex == product.variants.length - 1) {
						stringCon = stringCon.slice(0, -1)
						stringCon = stringCon + 'RETURNING id as "ProductID",  title as "Title", tags as "Tags", created_at as "CreatedAt", updated_at as "UpdatedAt", sku as "ProductCode";'
					}
					sqlString = sqlString + stringCon
				}

			}
		}
		// ? Uncomment when start
		if (newProductCount > 0) {
			const posts = await sql(sqlString);
			const allProducts = await sql('SELECT id as "ProductID",  title as "Title", tags as "Tags", created_at as "CreatedAt", updated_at as "UpdatedAt", sku as "ProductCode" FROM products;');
			return new Response(JSON.stringify({ RecentlyAdded: posts, AllProducts: allProducts }), { headers: { "content-type": "application/json" } });
		} else {
			return new Response(JSON.stringify("No new products"), { headers: { "content-type": "application/json" } });

		}
	}
	else if (pathname.startsWith("/api/products") && request.method == "DELETE") {
		if (urlParams) {
			let id = urlParams.toString();
			await sql("DELETE FROM products WHERE id = $1", [id]);
			return new Response("Product ID " + id + " Has been Successfully Deleted", { headers: { "content-type": "application/json" } });
		} else {
			let id = pathname.substring(pathname.lastIndexOf("/") + 1);
			await sql("DELETE FROM products WHERE id = $1", [id]);
			return new Response("Product ID " + id + " Has been Successfully Deleted", { headers: { "content-type": "application/json" } });
		}
	}
	else if (pathname.startsWith("/api/products") && request.method == "PUT") {
		let Products = await sql(`UPDATE products set title = title|| ' - ' ||sku RETURNING id as "ProductID", title as "Title", tags as "Tags", created_at as "CreatedAt", updated_at as "UpdatedAt", sku as "ProductCode";`);
		return new Response(JSON.stringify(Products), { headers: { "content-type": "application/json" } });
	}
	return new Response("API Call Does not exist", { status: 404 });
}


async function readRequestBody(request: Request) {
	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return JSON.stringify(await request.json());
	} else if (contentType?.includes("application/text")) {
		return request?.text();
	} else if (contentType?.includes("text/html")) {
		return request.text();
	} else if (contentType?.includes("form")) {
		const formData = await request.formData();
		const body: any = {};
		for (const entry of formData.entries()) {
			body[entry[0]] = entry[1];
		}
		return JSON.stringify(body);
	} else {
		// Perhaps some other type of data was submitted in the form
		// like an image, or some other binary data.
		return "a file";
	}
}

