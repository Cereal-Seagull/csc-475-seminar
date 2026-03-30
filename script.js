const LANGS_CONV = {
    "English": "Eng",
    "Middle-English": "ME",
    "Latin": "Lat",
    "French": "Fr",
    "German": "Ger",
    "Spanish": "Sp",
    "Italian": "It",
    "Greek": "Grk",
    "Ancient-Greek": "AGrk",
    "Old-High-German": "OHG",
    "Proto-Germanic": "PGmc",
    "Proto-West-Germanic": "PWGmc",
    "Proto-Indo-European": "PIE",
    "Anglo-Norman": "AngNorm",
    "Old-French": "OF",
    "Old-Italian": "OIt",
    "Old-Spanish": "OSp",
    "Old-Portuguese": "OPt",
    "Old-Norse": "ON",
    "Old-Swedish": "OSw",
    "Old-Danish": "ODan",
    "Old-Icelandic": "OIsl",
    "Old-English": "OE",}

async function initialize() {
    // Implementation for initialization
}

async function performSearch(searchTerm) {
    // Search through wiktionary_data.json
    fetch('wiktionary_data.json')
        .then(response => response.json())
        .then(data => {
            const results = data.filter(entry => entry["English Word"].toLowerCase().includes(searchTerm.toLowerCase()));
            // convert 
            const etyms = results.map(result => result["Etymologies"]);
            console.log(etyms);
            // For now, let's only focus on if there's only one etymology, and we can expand later
           
            etym = etyms[0]["Etymology 1"] || etyms[0]["Etymology"];
            languages = ["English"].concat(Object.keys(etym));
            languages = languages.map(lang => LANGS_CONV[lang] || lang);

            // format of wordInfo is [{word: "word1", link: "link1"}, {word: "word2", link: "link2"}, ...]
            placeholder = [{word: searchTerm, link: ""}];
            wordInfo = [placeholder].concat(Object.values(etym));

            
            console.log("Info: ", wordInfo);
            // retrieve words, not links

            console.log(languages);
            // console.log(wordForms);
            wordForms = wordInfo.map(info => info.map(item => item["word"]).join("/"));
            console.log(wordForms);

            // Build relationship labels per edge when possible; otherwise fall back later in constructGraph.
            const relationshipLabels = Object.values(etym).map(stepEntries => {
                if (!Array.isArray(stepEntries) || stepEntries.length === 0) {
                    return null;
                }

                const firstEntry = stepEntries[0] || {};
                return firstEntry.relationship || firstEntry.relation || firstEntry.type || firstEntry.note || null;
            });

            constructGraph(languages, wordForms, relationshipLabels);

        });
}

// This function was generated with the help of GitHub Copilot and was modified accordingly.
// It is a very basic implementation of a graph visualization using D3.js, and will be expanded later to include more complex relationships and interactivity.
function constructGraph(langPath, wordPath, relationshipPath = []) {
    // Constructing a simple static linear graph with D3.js showing historical word evolution
    // To be expanded later to include multiple, complex relationships

    // Clear any existing graph
    d3.select("#graph-container").selectAll("svg").remove();

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const width = 1000;
    const height = 300;
    const minNodeRadius = 22;
    const nodePadding = 10;
    const labelFontSize = 16;
    const lineHeight = 14;
    const langLabelOffset = 25;
    const langLabelFontSize = 12;
    const linkLabelOffsetY = -8;
    const sanitizeForClass = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const svg = d3.select("#graph-container")
        .append("svg")
        .attr("id", "etymology-graph-container")
        // .attr("class", "etymology-graph")
        .attr("width", width)
        .attr("height", height);

    // Create nodes with static horizontal positioning
    const nodes = wordPath.map((word, index) => ({
        id: word,
        labelLines: word.split("/").map(part => part.trim()).filter(Boolean),
        lang: langPath[index],
        x: margin.left + (index * (width - margin.left - margin.right) / (wordPath.length - 1 || 1)),
        y: height / 2,
        nodeRadius: minNodeRadius
    }));

    // Measure text so each node radius fits its label content.
    const measurementGroup = svg.append("g")
        .attr("class", "measurement-layer")
        .attr("opacity", 0)
        .attr("pointer-events", "none");

    nodes.forEach(node => {
        const measurementText = measurementGroup.append("text")
            .attr("font-size", `${labelFontSize}px`)
            .attr("font-weight", "bold")
            .attr("text-anchor", "middle");

        const lines = node.labelLines.length ? node.labelLines : [node.id];
        const startOffset = -((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, lineIndex) => {
            measurementText.append("tspan")
                .attr("x", 0)
                .attr("dy", lineIndex === 0 ? startOffset : lineHeight)
                .text(line);
        });

        const textBounds = measurementText.node().getBBox();
        const radiusFromWidth = textBounds.width / 2 + nodePadding;
        const radiusFromHeight = textBounds.height / 2 + nodePadding;
        node.nodeRadius = Math.max(minNodeRadius, radiusFromWidth, radiusFromHeight);

        measurementText.remove();
    });

    measurementGroup.remove();

    // Keep nodes and labels inside the SVG bounds.
    const maxNodeRadius = d3.max(nodes, d => d.nodeRadius) || minNodeRadius;
    const minY = margin.top + maxNodeRadius;
    const maxY = height - margin.bottom - langLabelOffset - langLabelFontSize - maxNodeRadius;
    const boundedY = Math.max(minY, Math.min(maxY, height / 2));

    const nodeCount = nodes.length;
    const firstRadius = nodeCount > 0 ? nodes[0].nodeRadius : minNodeRadius;
    const lastRadius = nodeCount > 0 ? nodes[nodeCount - 1].nodeRadius : minNodeRadius;
    const startX = margin.left + firstRadius;
    const endX = width - margin.right - lastRadius;

    nodes.forEach((node, index) => {
        const linearX = nodeCount === 1
            ? (startX + endX) / 2
            : startX + (index * (endX - startX) / (nodeCount - 1));
        const minX = margin.left + node.nodeRadius;
        const maxX = width - margin.right - node.nodeRadius;
        node.x = Math.max(minX, Math.min(maxX, linearX));
        node.y = boundedY;
    });

    // Create links between consecutive nodes
    const links = nodes.slice(1).map((node, index) => ({
        source: nodes[index],
        target: node,
        relationshipLabel: relationshipPath[index] || `derived from`
    }));

    function pointAtDistance(start, end, distanceFromStart) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        return {
            x: start.x + (dx / length) * distanceFromStart,
            y: start.y + (dy / length) * distanceFromStart
        };
    }

    // Define arrow marker for links
    svg.append("defs")
        .attr("id", "graph-defs")
        .append("marker")
        .attr("id", "arrowhead")
        .attr("class", "graph-marker graph-marker-arrowhead")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("refX", 10)
        .attr("refY", 3)
        .attr("orient", "auto")
        .append("polygon")
        .attr("points", "0 0, 10 3, 0 6")
        .attr("fill", "#666");

    // Clip rendered graph elements so they stay inside the SVG bounds.
    svg.append("defs")
        .attr("class", "graph-defs-clip")
        .append("clipPath")
        .attr("id", "graph-clip")
        .attr("class", "graph-clip-path")
        .append("rect")
        .attr("class", "graph-clip-rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

    const graphLayer = svg.append("g")
        .attr("id", "graph-layer")
        .attr("class", "graph-layer")
        .attr("clip-path", "url(#graph-clip)");

    // Draw links with arrows
    graphLayer.append("g")
        .attr("id", "links-layer")
        .attr("class", "links-layer")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("id", (d, i) => `graph-link-${i}`)
        .attr("class", "graph-link")
        .attr("data-source-lang", d => sanitizeForClass(d.source.lang))
        .attr("data-target-lang", d => sanitizeForClass(d.target.lang))
        .attr("x1", d => pointAtDistance(d.source, d.target, d.source.nodeRadius).x)
        .attr("y1", d => pointAtDistance(d.source, d.target, d.source.nodeRadius).y)
        .attr("x2", d => pointAtDistance(d.target, d.source, d.target.nodeRadius).x)
        .attr("y2", d => pointAtDistance(d.target, d.source, d.target.nodeRadius).y)
        .attr("marker-end", "url(#arrowhead)");

    // Draw relationship labels for links
    graphLayer.append("g")
        .attr("id", "link-labels-layer")
        .attr("class", "link-labels-layer")
        .selectAll("text")
        .data(links)
        .enter()
        .append("text")
        .attr("id", (d, i) => `graph-link-label-${i}`)
        .attr("class", "graph-link-label")
        .attr("data-source-lang", d => sanitizeForClass(d.source.lang))
        .attr("data-target-lang", d => sanitizeForClass(d.target.lang))
        .attr("x", d => {
            const start = pointAtDistance(d.source, d.target, d.source.nodeRadius);
            const end = pointAtDistance(d.target, d.source, d.target.nodeRadius);
            return (start.x + end.x) / 2;
        })
        .attr("y", d => {
            const start = pointAtDistance(d.source, d.target, d.source.nodeRadius);
            const end = pointAtDistance(d.target, d.source, d.target.nodeRadius);
            return ((start.y + end.y) / 2) + linkLabelOffsetY;
        })
        .attr("text-anchor", "middle")
        .text(d => d.relationshipLabel)
        .attr("font-size", `${langLabelFontSize}px`);

    // Draw nodes
    graphLayer.append("g")
        .attr("id", "nodes-layer")
        .attr("class", "nodes-layer")
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("id", (d, i) => `graph-node-${i}`)
        .attr("class", d => `graph-node lang-${sanitizeForClass(d.lang)}`)
        .attr("data-lang", d => d.lang)
        .attr("data-word", d => d.id)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.nodeRadius)

    // Draw labels
    graphLayer.append("g")
        .attr("id", "labels-layer")
        .attr("class", "labels-layer")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("id", (d, i) => `graph-node-label-${i}`)
        .attr("class", d => `graph-node-label lang-${sanitizeForClass(d.lang)}`)
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .each(function(d) {
            const text = d3.select(this)
                .append("text")
                .attr("class", "graph-node-label-text")
                .attr("font-size", `${labelFontSize}px`)

            const lines = d.labelLines.length ? d.labelLines : [d.id];
            const startOffset = -((lines.length - 1) * lineHeight) / 2;
            lines.forEach((line, lineIndex) => {
                text.append("tspan")
                    .attr("class", "graph-node-label-line")
                    .attr("x", 0)
                    .attr("dy", lineIndex === 0 ? startOffset : lineHeight)
                    .text(line);
            });
        });

    // Draw word labels below nodes
    graphLayer.append("g")
        .attr("id", "lang-labels-layer")
        .attr("class", "lang-labels-layer")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("id", (d, i) => `graph-lang-label-${i}`)
        .attr("class", d => `graph-lang-label lang-${sanitizeForClass(d.lang)}`)
        .attr("data-lang", d => d.lang)
        .attr("x", d => d.x)
        .attr("y", d => d.y + d.nodeRadius + 25)
        .attr("font-size", `${langLabelFontSize}px`)
        .text(d => `(${d.lang})`);
}